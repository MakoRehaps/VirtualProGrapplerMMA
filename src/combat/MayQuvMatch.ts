import { Rng } from "@/sim/Rng";
import { resolveTechniqueImpact } from "./mayQuvDamage";
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
}

export class MayQuvMatch {
  readonly rng: Rng;
  readonly player: FighterState;
  readonly opponent: FighterState;
  private pending: PendingTechnique[] = [];
  private log: MayQuvExchange[] = [];
  private groundedUntil: Partial<Record<CombatSide, number>> = {};
  winner: CombatSide | null = null;
  finish: MayQuvMatchSnapshot["finish"] = null;

  canConnect: ((attacker: CombatSide, technique: TechniqueRuntime) => boolean) | null = null;
  contactRegion: ((attacker: CombatSide, technique: TechniqueRuntime) => keyof FighterCondition["regions"] | null) | null = null;
  onResolved: ((attacker: CombatSide, defender: CombatSide, resolution: CombatResolution) => void) | null = null;

  constructor(
    playerLoadout: FighterLoadout,
    opponentLoadout: FighterLoadout,
    seed = 0x4d415951,
    playerCondition?: FighterCondition,
    opponentCondition?: FighterCondition
  ) {
    this.rng = new Rng(seed);
    this.player = createFighterState(playerLoadout);
    this.opponent = createFighterState(opponentLoadout);
    if (playerCondition) this.player.condition = structuredClone(playerCondition);
    if (opponentCondition) this.opponent.condition = structuredClone(opponentCondition);
  }

  stateOf(side: CombatSide): FighterState {
    return side === "player" ? this.player : this.opponent;
  }

  throwTechnique(
    attacker: CombatSide,
    technique: TechniqueRuntime,
    currentFrame: number,
    sample: ImpactSample
  ): boolean {
    if (this.winner) return false;
    const state = this.stateOf(attacker);
    if (!styleAllowsTechnique(state.loadout.styleId, technique.techniqueId)) return false;
    if (!isTechniqueActive(technique)) return false;
    if (state.condition.stamina < technique.staminaCost) return false;

    this.pending.push({
      attacker,
      technique,
      landsOnFrame: currentFrame + technique.startupFrames,
      sample,
    });
    return true;
  }

  step(frame: number): void {
    if (this.winner) return;
    this.updateGroundedWindow(frame);
    if (!this.pending.length) return;
    const due = this.pending.filter((p) => p.landsOnFrame <= frame);
    this.pending = this.pending.filter((p) => p.landsOnFrame > frame);
    for (const hit of due) this.resolve(hit, frame);
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
      });
      return;
    }

    const actualRegion = this.contactRegion?.(hit.attacker, hit.technique) ?? undefined;
    const result = resolveTechniqueImpact(
      this.stateOf(hit.attacker),
      this.stateOf(defenderSide),
      hit.technique,
      { ...hit.sample, actualRegion }
    );

    this.record({
      frame,
      attacker: hit.attacker,
      techniqueName: hit.technique.name,
      connected: true,
      resolution: result,
    });
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
    }
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
    };
  }
}
