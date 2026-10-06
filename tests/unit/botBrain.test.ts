import { describe, expect, it } from "vitest";
import { BotBrain } from "@/ai/BotBrain";
import { MayQuvMatch } from "@/combat/MayQuvMatch";
import {
  isTechniqueActive,
  styleAllowsTechnique,
  techniqueById,
} from "@/data/combatCatalog";
import type { FighterLoadout } from "@/combat/mayQuvTypes";

function fighter(id: string, styleId: string): FighterLoadout {
  return {
    id,
    name: id,
    styleId,
    stanceId:
      styleId === "boxing"
        ? "boxing_orthodox"
        : styleId === "judo"
          ? "judo_grip_ready"
          : "sambo_hybrid",
    body: {
      massKg: 77,
      heightM: 1.78,
      reachM: 1.81,
      centerOfMassHeightRatio: 0.56,
    },
  };
}

function sequence(seed: number): string[] {
  const match = new MayQuvMatch(
    fighter("player", "boxing"),
    fighter("bot", "combat_sambo"),
    seed
  );
  const chosen: string[] = [];
  const brain = new BotBrain(
    match,
    "opponent",
    "club",
    (techniqueId) => {
      chosen.push(techniqueId);
      return true;
    }
  );

  for (let frame = 0; frame < 240; frame++) {
    brain.step(frame);
  }

  return chosen;
}

describe("BotBrain", () => {
  it("is deterministic for a fixed match seed", () => {
    expect(sequence(12345)).toEqual(sequence(12345));
  });

  it("varies decisions when the deterministic seed changes", () => {
    expect(sequence(12345)).not.toEqual(sequence(54321));
  });

  it("selects only active techniques legal for the bot's style", () => {
    const moves = sequence(9988);
    expect(moves.length).toBeGreaterThan(0);

    for (const id of moves) {
      const technique = techniqueById(id);
      expect(technique).toBeTruthy();
      expect(styleAllowsTechnique("combat_sambo", id)).toBe(true);
      expect(isTechniqueActive(technique!)).toBe(true);
    }
  });
});
