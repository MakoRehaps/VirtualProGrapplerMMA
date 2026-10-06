import { describe, expect, it } from "vitest";
import { MayQuvMatch } from "@/combat/MayQuvMatch";
import { techniqueById } from "@/data/combatCatalog";
import type { FighterLoadout } from "@/combat/mayQuvTypes";

function fighter(id: string): FighterLoadout {
  return {
    id,
    name: id,
    styleId: "boxing",
    stanceId: "boxing_orthodox",
    body: {
      massKg: 77,
      heightM: 1.78,
      reachM: 1.81,
      centerOfMassHeightRatio: 0.56,
    },
  };
}

const sample = {
  relativeVelocityMps: 6.2,
  contactQuality: "clean" as const,
  guard: "none" as const,
};

describe("stamina recovery", () => {
  it("waits through the idle delay before recovering", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const cross = techniqueById("cross")!;

    match.throwTechnique("player", cross, 0, sample);
    const afterLaunch = match.player.condition.stamina;

    match.step(29);
    expect(match.player.condition.stamina).toBe(afterLaunch);

    match.step(60);
    expect(match.player.condition.stamina).toBeGreaterThan(afterLaunch);
  });

  it("damaged body condition recovers stamina more slowly", () => {
    const fresh = new MayQuvMatch(fighter("a"), fighter("b"));
    const worn = new MayQuvMatch(fighter("a"), fighter("b"));
    const cross = techniqueById("cross")!;

    fresh.player.condition.stamina = 50;
    worn.player.condition.stamina = 50;
    worn.player.condition.regions.body = 20;

    fresh.throwTechnique("player", cross, 0, sample);
    worn.throwTechnique("player", cross, 0, sample);

    const freshAfterLaunch = fresh.player.condition.stamina;
    const wornAfterLaunch = worn.player.condition.stamina;

    fresh.step(90);
    worn.step(90);

    const freshRecovered =
      fresh.player.condition.stamina - freshAfterLaunch;
    const wornRecovered =
      worn.player.condition.stamina - wornAfterLaunch;

    expect(freshRecovered).toBeGreaterThan(wornRecovered);
  });
});
