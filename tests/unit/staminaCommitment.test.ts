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

describe("technique stamina commitment", () => {
  it("charges stamina immediately even when the move later whiffs", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const cross = techniqueById("cross")!;
    match.canConnect = () => false;

    const before = match.player.condition.stamina;
    expect(match.throwTechnique("player", cross, 0, sample)).toBe(true);
    expect(match.player.condition.stamina).toBeLessThan(before);

    const afterLaunch = match.player.condition.stamina;
    match.step(cross.startupFrames);
    expect(match.lastExchange?.connected).toBe(false);
    expect(match.player.condition.stamina).toBe(afterLaunch);
  });

  it("does not charge stamina twice when the move connects", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const cross = techniqueById("cross")!;

    const before = match.player.condition.stamina;
    expect(match.throwTechnique("player", cross, 0, sample)).toBe(true);
    const afterLaunch = match.player.condition.stamina;

    match.step(cross.startupFrames);

    expect(afterLaunch).toBeLessThan(before);
    expect(match.player.condition.stamina).toBe(afterLaunch);
    expect(match.lastExchange?.resolution?.staminaSpent).toBe(
      Math.round((before - afterLaunch) * 10) / 10
    );
  });

  it("body wear raises the launch stamina cost", () => {
    const fresh = new MayQuvMatch(fighter("a"), fighter("b"));
    const worn = new MayQuvMatch(fighter("a"), fighter("b"));
    const cross = techniqueById("cross")!;

    worn.player.condition.regions.body = 25;

    fresh.throwTechnique("player", cross, 0, sample);
    worn.throwTechnique("player", cross, 0, sample);

    expect(worn.player.condition.stamina).toBeLessThan(
      fresh.player.condition.stamina
    );
  });
});
