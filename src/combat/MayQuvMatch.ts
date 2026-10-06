import { Rng } from "@/sim/Rng";
import rulesetsJson from "#data/game/rulesets.json";
import { freshJudgingStats, scoreWholeFight, type JudgingScore, type JudgingStats } from "./judging";
import { resolveTechniqueImpact } from "./mayQuvDamage";
import { regionConsequences } from "./regionalCondition";
import { ACTIVE_COMBAT_PROFILE, isPositionActive, isTechniqueActive, styleAllowsTechnique } from "@/data/combatCatalog";
import {
  createFighterState,
  type CombatResolution,
  type CombatSide,
  type FighterCondition,
  type FighterLoadout,
  type FighterState,
  type ImpactSample,
  type TechniqueRuntime,
} from "./mayQuvTypes";

interface PendingTechnique {
  attacker: CombatSide;
  technique: TechniqueRuntime;
  landsOnFrame: number;
  sample: ImpactSample;
}

export interface MayQuvExchange {
  frame: number;
  attacker: CombatSide;
  techniqueName: string;
  connected: boolean;
  missReason?: string;
  resolution?: CombatResolution;
}

export interface MayQuvFighterSnapshot {
  name: string;
  styleId: string;
  stanceId: string;
  hp: number;
  stamina: number;
  consciousness: number;
  balance: number;
  regions: FighterCondition["regions"];
  positionId: string;
}

export interface MayQuvMatchSnapshot {
  player: MayQuvFighterSnapshot;
  opponent: MayQuvFighterSnapshot;
  last: MayQuvExchange | null;
  history: MayQuvExchange[];
  draws: number;
  winner: CombatSide | null;
  finish: "ko" | "submission" | "decision" | "forfeit" | null;
  elapsedFrames: number;
  timeLimitFrames: number | null;
  decision: JudgingScore | null;
}

export class MayQuvMatch {
  readonly rng: Rng;
  readonly player: FighterState;
  readonly opponent: FighterState;
  private pending: PendingTechnique[] = [];
  private log: MayQuvExchange[] = [];
  private groundedUntil: Partial<Record<CombatSide, number>> = {};
  private lastStepFrame = 0;
  private lastTechniqueFrame: Record<CombatSide, number> = {
    player: -10_000,
    opponent: -10_000,
  };
  winner: CombatSide | null = null;
  finish: MayQuvMatchSnapshot["finish"] = null;

  canConnect: ((attacker: CombatSide, technique: TechniqueRuntime) => boolean) | null = null;
  contactRegion: ((attacker: CombatSide, technique: TechniqueRuntime) => keyof FighterCondition["regions"] | null) | null = null;
  onResolved: ((attacker: CombatSide, defender: CombatSide, resolution: CombatResolution) => void) | null = null;
  onGroundedWindowChanged: ((side: CombatSide, active: boolean) => void) | null = null;
  onPositionChanged: ((playerPosition: string, opponentPosition: string) => void) | null = null;
  guardState: ((side: CombatSide) => "none" | "partial" | "solid") | null = null;
  evasionState: ((side: CombatSide) => { horizontal: number; vertical: number }) | null = null;
  grappleDefenseState: ((side: CombatSide) => { sprawl: boolean; whizzer: boolean }) | null = null;
  onDefended: ((defender: CombatSide, kind: "evade" | "sprawl" | "whizzer") => void) | null = null;
  private counterWindowUntil: Partial<Record<CombatSide, number>> = {};
  private readonly judgingStats: Record<CombatSide, JudgingStats> =
    freshJudgingStats();
  private readonly timeLimitFrames: number | null;
  private decision: JudgingScore | null = null;

  constructor(
    playerLoadout: FighterLoadout,
    opponentLoadout: FighterLoadout,
    seed = 0x4d415951,
    playerCondition?: FighterCondition,
    opponentCondition?: FighterCondition
  ) {
    this.rng = new Rng(seed);
    const standardRuleset = rulesetsJson.rulesets.find(
      (r) => r.ruleset_id === "may_quv_standard"
    );
    const roundSeconds =
      standardRuleset?.rounds?.reduce((sum, seconds) => sum + seconds, 0) ?? 0;
    this.timeLimitFrames = roundSeconds > 0 ? roundSeconds * 60 : null;

    this.player = createFighterState(playerLoadout);
    this.opponent = createFighterState(opponentLoadout);
    if (playerCondition) this.player.condition = structuredClone(playerCondition);
    if (opponentCondition) this.opponent.condition = structuredClone(opponentCondition);
  }

  stateOf(side: CombatSide): FighterState {
    return side === "player" ? this.player : this.opponent;
  }

  private techniqueLegalFromPosition(
    state: FighterState,
    technique: TechniqueRuntime
  ): boolean {
    const position = state.positionId;

    if (technique.context === "grounded_opponent") {
      return position === "standing_over_grounded";
    }

    if (technique.context === "clinch") {
      return [
        "single_collar_tie",
        "thai_plum",
        "over_under",
        "double_underhooks",
        "rear_clinch",
        "front_headlock",
      ].includes(position);
    }

    if (technique.context === "takedown") {
      return position === "standing_close" || position === "front_headlock";
    }

    if (technique.context === "standing") {
      return position === "standing_open" || position === "standing_close";
    }

    return false;
  }

  enterClinch(
    initiator: CombatSide,
    position:
      | "single_collar_tie"
      | "thai_plum"
      | "over_under"
      | "double_underhooks"
      | "rear_clinch"
      | "front_headlock" = "over_under"
  ): boolean {
    if (this.finish) return false;

    const other: CombatSide = initiator === "player" ? "opponent" : "player";
    const initiatorState = this.stateOf(initiator);
    const otherState = this.stateOf(other);

    const standing = new Set(["standing_open", "standing_close"]);
    if (!standing.has(initiatorState.positionId)) return false;
    if (!standing.has(otherState.positionId)) return false;
    if (!isPositionActive(position)) return false;

    initiatorState.positionId = position;
    otherState.positionId = position;
    this.onPositionChanged?.(this.player.positionId, this.opponent.positionId);
    return true;
  }

  exitClinch(): boolean {
    const clinchPositions = new Set([
      "single_collar_tie",
      "thai_plum",
      "over_under",
      "double_underhooks",
      "rear_clinch",
      "front_headlock",
    ]);

    const playerInClinch = clinchPositions.has(this.player.positionId);
    const opponentInClinch = clinchPositions.has(this.opponent.positionId);
    if (!playerInClinch && !opponentInClinch) return false;

    this.player.positionId = "standing_close";
    this.opponent.positionId = "standing_close";
    this.onPositionChanged?.(this.player.positionId, this.opponent.positionId);
    return true;
  }

  requestTechnicalStandup(side: CombatSide): boolean {
    if (!ACTIVE_COMBAT_PROFILE.grounded_window.defender_can_technical_stand) {
      return false;
    }
    if (this.stateOf(side).positionId !== "seated_guard") return false;

    const other: CombatSide = side === "player" ? "opponent" : "player";
    this.stateOf(side).positionId = "standing_open";
    if (this.stateOf(other).positionId === "standing_over_grounded") {
      this.stateOf(other).positionId = "standing_open";
    }
    delete this.groundedUntil[side];
    this.onPositionChanged?.(this.player.positionId, this.opponent.positionId);
    this.onGroundedWindowChanged?.(side, false);
    return true;
  }

  throwTechnique(
    attacker: CombatSide,
    technique: TechniqueRuntime,
    currentFrame: number,
    sample: ImpactSample
  ): boolean {
    if (this.finish) return false;
    const state = this.stateOf(attacker);
    if (!styleAllowsTechnique(state.loadout.styleId, technique.techniqueId)) return false;
    if (!isTechniqueActive(technique)) return false;
    if (!this.techniqueLegalFromPosition(state, technique)) return false;

    const staminaCommitted =
      Math.round(
        technique.staminaCost *
          regionConsequences(state.condition).staminaCostScale *
          10
      ) / 10;
    if (state.condition.stamina < staminaCommitted) return false;

    state.condition.stamina = Math.max(
      0,
      Math.round((state.condition.stamina - staminaCommitted) * 10) / 10
    );
    this.lastTechniqueFrame[attacker] = currentFrame;

    const counterStartupBonusFrames =
      technique.type === "strike" && this.isCounterWindow(attacker, currentFrame)
        ? 2
        : 0;

    this.pending.push({
      attacker,
      technique,
      landsOnFrame:
        currentFrame + Math.max(1, technique.startupFrames - counterStartupBonusFrames),
      sample: { ...sample, staminaCommitted },
    });

    if (counterStartupBonusFrames > 0) {
      delete this.counterWindowUntil[attacker];
    }
    return true;
  }

  step(frame: number): void {
    if (this.finish) return;
    this.recoverStamina(frame);
    this.updateGroundedWindow(frame);

    if (
      this.timeLimitFrames !== null &&
      frame >= this.timeLimitFrames
    ) {
      this.finishByDecision(frame);
      return;
    }

    if (!this.pending.length) return;
    const due = this.pending.filter((p) => p.landsOnFrame <= frame);
    this.pending = this.pending.filter((p) => p.landsOnFrame > frame);
    for (const hit of due) this.resolve(hit, frame);
  }

  private recoverStamina(frame: number): void {
    const previousFrame = this.lastStepFrame;
    this.lastStepFrame = frame;
    if (frame <= previousFrame) return;

    const basePerSecond = 8;
    const idleDelayFrames = 30;

    for (const side of ["player", "opponent"] as CombatSide[]) {
      const recoveryStartsAt =
        this.lastTechniqueFrame[side] + idleDelayFrames;
      const fromFrame = Math.max(previousFrame, recoveryStartsAt);
      const recoverableFrames = Math.max(0, frame - fromFrame);
      if (recoverableFrames <= 0) continue;

      const state = this.stateOf(side);
      if (state.condition.stamina >= 100) continue;

      const bodyPenalty =
        regionConsequences(state.condition).staminaCostScale;
      const recoveryScale = 1 / Math.max(1, bodyPenalty);
      const recovered =
        (recoverableFrames / 60) * basePerSecond * recoveryScale;

      state.condition.stamina = Math.min(
        100,
        Math.round((state.condition.stamina + recovered) * 10) / 10
      );
    }
  }

  private updateGroundedWindow(frame: number): void {
    for (const side of ["player", "opponent"] as CombatSide[]) {
      const until = this.groundedUntil[side];
      if (until === undefined || frame < until) continue;

      const other: CombatSide = side === "player" ? "opponent" : "player";
      this.stateOf(side).positionId = "standing_open";
      if (this.stateOf(other).positionId === "standing_over_grounded") {
        this.stateOf(other).positionId = "standing_open";
      }
      delete this.groundedUntil[side];
      this.onGroundedWindowChanged?.(side, false);
    }
  }

  private resolve(hit: PendingTechnique, frame: number): void {
    const defenderSide: CombatSide = hit.attacker === "player" ? "opponent" : "player";
    const reachable = this.canConnect?.(hit.attacker, hit.technique) ?? true;

    if (!reachable) {
      this.record({
        frame,
        attacker: hit.attacker,
        techniqueName: hit.technique.name,
        connected: false,
        missReason: "out of range",
      // Logged misses/defenses remain visible but do not score as damage.
      });
      return;
    }

    const evasion = this.evasionState?.(defenderSide) ?? {
      horizontal: 0,
      vertical: 0,
    };
    const headTarget =
      hit.technique.target === "head" ||
      hit.technique.target === "face";
    const evasiveMagnitude = Math.max(
      Math.abs(evasion.horizontal),
      Math.abs(evasion.vertical)
    );
    if (
      hit.technique.type === "strike" &&
      headTarget &&
      evasiveMagnitude >= 0.58
    ) {
      this.counterWindowUntil[defenderSide] = frame + 24;
      this.onDefended?.(defenderSide, "evade");
      this.record({
        frame,
        attacker: hit.attacker,
        techniqueName: hit.technique.name,
        connected: false,
        missReason: "evaded",
      // Logged misses/defenses remain visible but do not score as damage.
      });
      return;
    }

    const grappleDefense = this.grappleDefenseState?.(defenderSide) ?? {
      sprawl: false,
      whizzer: false,
    };

    const isStandingShot =
      hit.technique.type === "takedown" &&
      hit.technique.context === "standing";
    const isClinchTakedown =
      (hit.technique.type === "takedown" ||
        hit.technique.type === "throw") &&
      hit.technique.context === "clinch";

    if (isStandingShot && grappleDefense.sprawl) {
      this.counterWindowUntil[defenderSide] = frame + 30;
      this.onDefended?.(defenderSide, "sprawl");
      this.record({
        frame,
        attacker: hit.attacker,
        techniqueName: hit.technique.name,
        connected: false,
        missReason: "sprawled",
      // Logged misses/defenses remain visible but do not score as damage.
      });
      return;
    }

    if (isClinchTakedown && grappleDefense.whizzer) {
      this.counterWindowUntil[defenderSide] = frame + 24;
      this.onDefended?.(defenderSide, "whizzer");
      this.record({
        frame,
        attacker: hit.attacker,
        techniqueName: hit.technique.name,
        connected: false,
        missReason: "whizzered",
      // Logged misses/defenses remain visible but do not score as damage.
      });
      return;
    }

    if (hit.technique.type === "control") {
      this.resolveControlTechnique(hit, defenderSide, frame);
      return;
    }

    if (hit.technique.type === "defense") {
      this.judgingStats[hit.attacker].defendedOffense += 1;
      this.record({
        frame,
        attacker: hit.attacker,
        techniqueName: hit.technique.name,
        connected: true,
      });
      return;
    }

    const actualRegion = this.contactRegion?.(hit.attacker, hit.technique) ?? undefined;
    const liveGuard = this.guardState?.(defenderSide) ?? hit.sample.guard;
    const result = resolveTechniqueImpact(
      this.stateOf(hit.attacker),
      this.stateOf(defenderSide),
      hit.technique,
      { ...hit.sample, guard: liveGuard, actualRegion }
    );

    this.record({
      frame,
      attacker: hit.attacker,
      techniqueName: hit.technique.name,
      connected: true,
      resolution: result,
    });

    const judge = this.judgingStats[hit.attacker];
    judge.effectiveDamage += result.hpDamage;
    judge.consciousnessDamage += result.consciousnessDamage;
    judge.regionalDamage += result.regionalDamage;
    judge.connectedOffense += 1;
    if (result.knockedDown) judge.knockdowns += 1;

    this.onResolved?.(hit.attacker, defenderSide, result);

    if (result.knockedOut) {
      this.winner = hit.attacker;
      this.finish = "ko";
      this.pending.length = 0;
      return;
    }

    if (result.knockedDown) {
      const seconds = ACTIVE_COMBAT_PROFILE.grounded_window.max_seconds;
      const frames = Math.max(1, Math.round(seconds * 60));
      const defender = this.stateOf(defenderSide);
      const attacker = this.stateOf(hit.attacker);

      defender.positionId = isPositionActive("seated_guard")
        ? "seated_guard"
        : "standing_open";
      attacker.positionId = isPositionActive("standing_over_grounded")
        ? "standing_over_grounded"
        : "standing_open";
      this.groundedUntil[defenderSide] = frame + frames;
      this.onGroundedWindowChanged?.(defenderSide, true);
    }
  }

  private resolveControlTechnique(
    hit: PendingTechnique,
    defenderSide: CombatSide,
    frame: number
  ): void {
    let nextPosition: FighterState["positionId"] | null = null;

    switch (hit.technique.techniqueId) {
      case "collar_tie":
        nextPosition = "single_collar_tie";
        break;
      case "double_underhooks":
        nextPosition = "double_underhooks";
        break;
      case "underhook":
        nextPosition = "over_under";
        break;
      case "thai_plum":
        nextPosition = "thai_plum";
        break;
      default:
        break;
    }

    if (!nextPosition || !isPositionActive(nextPosition)) {
      this.record({
        frame,
        attacker: hit.attacker,
        techniqueName: hit.technique.name,
        connected: false,
        missReason: "unsupported control transition",
      });
      return;
    }

    this.stateOf(hit.attacker).positionId = nextPosition;
    this.stateOf(defenderSide).positionId = nextPosition;
    this.onPositionChanged?.(this.player.positionId, this.opponent.positionId);

    this.record({
      frame,
      attacker: hit.attacker,
      techniqueName: hit.technique.name,
      connected: true,
    });
  }

  isCounterWindow(side: CombatSide, frame: number): boolean {
    return (this.counterWindowUntil[side] ?? -1) >= frame;
  }

  private record(entry: MayQuvExchange): void {
    this.log.push(entry);
    if (this.log.length > 10) this.log.shift();
  }

  get lastExchange(): MayQuvExchange | null {
    return this.log.at(-1) ?? null;
  }

  snapshot(): MayQuvMatchSnapshot {
    const side = (s: FighterState): MayQuvFighterSnapshot => ({
      name: s.loadout.name,
      styleId: s.loadout.styleId,
      stanceId: s.loadout.stanceId,
      hp: Math.round(s.condition.hp * 10) / 10,
      stamina: Math.round(s.condition.stamina * 10) / 10,
      consciousness: Math.round(s.condition.consciousness * 10) / 10,
      balance: Math.round(s.condition.balance * 10) / 10,
      regions: { ...s.condition.regions },
      positionId: s.positionId,
    });
    return {
      player: side(this.player),
      opponent: side(this.opponent),
      last: this.lastExchange,
      history: [...this.log].reverse(),
      draws: this.rng.draws,
      winner: this.winner,
      finish: this.finish,
      elapsedFrames: this.lastStepFrame,
      timeLimitFrames: this.timeLimitFrames,
      decision: this.decision ? { ...this.decision } : null,
    };
  }
}
