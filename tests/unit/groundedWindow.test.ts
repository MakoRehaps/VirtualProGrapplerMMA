import { describe, expect, it } from "vitest";
import { MayQuvMatch } from "@/combat/MayQuvMatch";
import { techniqueById } from "@/data/combatCatalog";
import type { FighterLoadout } from "@/combat/mayQuvTypes";

function fighter(id: string): FighterLoadout {
  return {
    id,
    name: id,
    styleId: "american_kickboxing",
    stanceId: "american_kickboxing",
    body: {
      massKg: 77,
      heightM: 1.78,
      reachM: 1.81,
      centerOfMassHeightRatio: 0.56,
    },
  };
}

describe("grounded-opponent window", () => {
  it("rejects grounded attacks from neutral standing", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const soccer = techniqueById("soccer_kick_head")!;
    expect(
      match.throwTechnique("player", soccer, 0, {
        relativeVelocityMps: 8,
        contactQuality: "clean",
        guard: "none",
      })
    ).toBe(false);
  });

  it("accepts grounded attacks only while standing over a grounded opponent", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const soccer = techniqueById("soccer_kick_head")!;

    match.player.positionId = "standing_over_grounded";
    match.opponent.positionId = "seated_guard";

    expect(
      match.throwTechnique("player", soccer, 0, {
        relativeVelocityMps: 8,
        contactQuality: "clean",
        guard: "none",
      })
    ).toBe(true);
  });

  it("technical stand-up restores both fighters to standing", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    match.player.positionId = "standing_over_grounded";
    match.opponent.positionId = "seated_guard";

    expect(match.requestTechnicalStandup("opponent")).toBe(true);
    expect(match.player.positionId).toBe("standing_open");
    expect(match.opponent.positionId).toBe("standing_open");
  });
});
