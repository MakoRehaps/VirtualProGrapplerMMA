import botsJson from "#data/ai/bots.json";
import { activeTechniquesForStyle } from "@/data/combatCatalog";
import type {
  CombatSide,
  TechniqueRuntime,
} from "@/combat/mayQuvTypes";
import type { MayQuvMatch } from "@/combat/MayQuvMatch";

export type BotDifficultyId =
  | "learner"
  | "club"
  | "competitive"
  | "elite"
  | "master";

interface Difficulty {
  id: BotDifficultyId;
  reaction_frames: number;
  decision_error: number;
  combo_discipline: number;
  transition_skill: number;
  adaptation_rate: number;
  input_reading: false;
}

export class BotBrain {
  private nextDecisionFrame = 0;
  private guardUntilFrame = -1;
  private evadeUntilFrame = -1;
  private grappleDefenseUntilFrame = -1;
  private evadeHorizontal = 0;
  private evadeVertical = 0;
  private readonly difficulty: Difficulty;

  constructor(
    private readonly match: MayQuvMatch,
    private readonly side: CombatSide,
    difficultyId: BotDifficultyId,
    private readonly onTechnique: (techniqueId: string) => boolean,
    private readonly onEnterClinch: (() => boolean) | null = null
  ) {
    this.difficulty =
      (botsJson.difficulty_levels.find(
        (d) => d.id === difficultyId
      ) as Difficulty | undefined) ??
      (botsJson.difficulty_levels[1] as Difficulty);
  }

  step(frame: number): void {
    if (this.match.winner || frame < this.nextDecisionFrame) return;

    const state = this.match.stateOf(this.side);

    const defenseRoll = this.match.rng.nextInt(1000);
    const defenseThreshold = Math.round(
      100 + this.difficulty.transition_skill * 120
    );
    if (defenseRoll < defenseThreshold) {
      this.chooseDefense(frame, state.positionId);
      this.nextDecisionFrame =
        frame + this.difficulty.reaction_frames + 6;
      return;
    }

    if (
      (state.positionId === "standing_open" ||
        state.positionId === "standing_close") &&
      this.shouldTryClinch(state.loadout.styleId)
    ) {
      if (this.onEnterClinch?.()) {
        this.nextDecisionFrame =
          frame + this.difficulty.reaction_frames + 8;
        return;
      }
    }

    const candidates = this.candidatesForPosition(
      state.loadout.styleId,
      state.positionId
    );

    this.nextDecisionFrame =
      frame +
      this.difficulty.reaction_frames +
      this.match.rng.nextInt(
        Math.max(2, Math.round(this.difficulty.reaction_frames * 0.75))
      );

    if (!candidates.length) return;

    // Difficulty affects decision noise only. It never changes damage,
    // stamina, health, body physics or legal technique access.
    const errorRoll = this.match.rng.nextInt(10_000) / 10_000;
    let pool = candidates;
    if (
      errorRoll >= this.difficulty.decision_error &&
      candidates.length > 2
    ) {
      pool = candidates.filter((t) => this.isPreferred(t));
      if (!pool.length) pool = candidates;
    }

    const chosen = pool[this.match.rng.nextInt(pool.length)];
    if (!chosen) return;

    if (this.onTechnique(chosen.techniqueId)) {
      this.nextDecisionFrame = Math.max(
        this.nextDecisionFrame,
        frame + chosen.startupFrames + chosen.recoveryFrames
      );
    }
  }

  defenseState(frame: number): {
    guard: boolean;
    evasion: { horizontal: number; vertical: number };
    grapple: { sprawl: boolean; whizzer: boolean };
  } {
    return {
      guard: frame <= this.guardUntilFrame,
      evasion:
        frame <= this.evadeUntilFrame
          ? {
              horizontal: this.evadeHorizontal,
              vertical: this.evadeVertical,
            }
          : { horizontal: 0, vertical: 0 },
      grapple:
        frame <= this.grappleDefenseUntilFrame
          ? {
              sprawl: this.evadeVertical < -0.25,
              whizzer: Math.abs(this.evadeHorizontal) >= 0.25,
            }
          : { sprawl: false, whizzer: false },
    };
  }

  private chooseDefense(frame: number, positionId: string): void {
    const duration =
      this.difficulty.reaction_frames +
      6 +
      this.match.rng.nextInt(8);

    const inClinch = [
      "single_collar_tie",
      "thai_plum",
      "over_under",
      "double_underhooks",
      "rear_clinch",
      "front_headlock",
    ].includes(positionId);

    if (inClinch) {
      this.grappleDefenseUntilFrame = frame + duration;
      this.evadeHorizontal =
        this.match.rng.nextInt(2) === 0 ? -0.7 : 0.7;
      this.evadeVertical = 0;
      return;
    }

    const mode = this.match.rng.nextInt(3);
    if (mode === 0) {
      this.guardUntilFrame = frame + duration;
      return;
    }

    this.evadeUntilFrame = frame + duration;
    if (mode === 1) {
      this.evadeHorizontal =
        this.match.rng.nextInt(2) === 0 ? -0.75 : 0.75;
      this.evadeVertical = 0;
    } else {
      this.evadeHorizontal = 0;
      this.evadeVertical = this.match.rng.nextInt(2) === 0 ? -0.72 : 0.72;
    }

    this.grappleDefenseUntilFrame = frame + duration;
  }

  private shouldTryClinch(styleId: string): boolean {
    if (!this.onEnterClinch) return false;

    const hasClinchOffense = activeTechniquesForStyle(styleId).some(
      (t) =>
        t.context === "clinch" &&
        (t.type === "strike" ||
          t.type === "takedown" ||
          t.type === "throw")
    );
    if (!hasClinchOffense) return false;

    const threshold = Math.round(
      1000 * (0.08 + this.difficulty.transition_skill * 0.16)
    );
    return this.match.rng.nextInt(1000) < threshold;
  }

  private candidatesForPosition(
    styleId: string,
    positionId: string
  ): TechniqueRuntime[] {
    const all = activeTechniquesForStyle(styleId).filter(
      (t) =>
        t.type === "strike" ||
        t.type === "takedown" ||
        t.type === "throw" ||
        t.type === "control"
    );

    if (
      positionId === "standing_open" ||
      positionId === "standing_close"
    ) {
      return all.filter((t) => t.context === "standing");
    }

    if (
      [
        "single_collar_tie",
        "thai_plum",
        "over_under",
        "double_underhooks",
        "rear_clinch",
        "front_headlock",
      ].includes(positionId)
    ) {
      return all.filter((t) => t.context === "clinch");
    }

    if (positionId === "standing_over_grounded") {
      return all.filter((t) => t.context === "grounded_opponent");
    }

    return [];
  }

  private isPreferred(technique: TechniqueRuntime): boolean {
    const position = this.match.stateOf(this.side).positionId;

    if (position === "standing_over_grounded") {
      return technique.type === "strike";
    }

    if (
      [
        "single_collar_tie",
        "thai_plum",
        "over_under",
        "double_underhooks",
        "rear_clinch",
        "front_headlock",
      ].includes(position)
    ) {
      return (
        technique.type === "strike" ||
        technique.type === "takedown" ||
        technique.type === "throw"
      );
    }

    // Standing bots favour quick/moderate attacks while still occasionally
    // choosing slower committed techniques through the noisy path above.
    return (
      technique.context === "standing" &&
      technique.startupFrames <= 20
    );
  }
}
