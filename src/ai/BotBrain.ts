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
  private readonly difficulty: Difficulty;

  constructor(
    private readonly match: MayQuvMatch,
    private readonly side: CombatSide,
    difficultyId: BotDifficultyId,
    private readonly onTechnique: (techniqueId: string) => boolean
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
