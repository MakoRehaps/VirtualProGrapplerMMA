import { describe, expect, it } from "vitest";
import { MayQuvMatch } from "@/combat/MayQuvMatch";
import { techniqueById } from "@/data/combatCatalog";
import type { FighterLoadout } from "@/combat/mayQuvTypes";

function fighter(id: string): FighterLoadout {
  return {
    id,
    name: id,
    styleId: "adimurai",
    stanceId: "traditional_upright",
    body: {
      massKg: 77,
      heightM: 1.78,
      reachM: 1.81,
      centerOfMassHeightRatio: 0.56,
    },
  };
}

const sample = {
  relativeVelocityMps: 6.5,
  contactQuality: "clean" as const,
  guard: "none" as const,
};

describe("clinch state", () => {
  it("blocks clinch-only strikes from open standing", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const knee = techniqueById("rear_knee")!;
    expect(match.throwTechnique("player", knee, 0, sample)).toBe(false);
    it("control techniques change clinch position without damage", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const collar = techniqueById("collar_tie")!;

    match.player.positionId = "over_under";
    match.opponent.positionId = "over_under";
    const beforeHp = match.opponent.condition.hp;
    const beforeHead = match.opponent.condition.regions.head;

    expect(match.throwTechnique("player", collar, 0, sample)).toBe(true);
    match.step(collar.startupFrames);

    expect(match.player.positionId).toBe("single_collar_tie");
    expect(match.opponent.positionId).toBe("single_collar_tie");
    expect(match.opponent.condition.hp).toBe(beforeHp);
    expect(match.opponent.condition.regions.head).toBe(beforeHead);
  });
});

  it("allows clinch-only strikes after entering a legal clinch", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const knee = techniqueById("rear_knee")!;
    expect(match.enterClinch("player", "over_under")).toBe(true);
    expect(match.player.positionId).toBe("over_under");
    expect(match.opponent.positionId).toBe("over_under");
    expect(match.throwTechnique("player", knee, 0, sample)).toBe(true);
  });

  it("allows trip techniques while clinched", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const trip = techniqueById("inside_trip")!;
    expect(match.enterClinch("player", "over_under")).toBe(true);
    expect(match.throwTechnique("player", trip, 0, sample)).toBe(true);
  });

  it("exits back to close standing", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    expect(match.enterClinch("player", "single_collar_tie")).toBe(true);
    expect(match.exitClinch()).toBe(true);
    expect(match.player.positionId).toBe("standing_close");
    expect(match.opponent.positionId).toBe("standing_close");
  });
});
