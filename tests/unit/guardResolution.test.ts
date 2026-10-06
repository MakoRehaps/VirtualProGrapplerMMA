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

function run(guarded: boolean) {
  const match = new MayQuvMatch(fighter("a"), fighter("b"));
  const cross = techniqueById("cross")!;
  match.guardState = (side) =>
    side === "opponent" && guarded ? "solid" : "none";

  match.throwTechnique("player", cross, 0, {
    relativeVelocityMps: 6.2,
    contactQuality: "clean",
    guard: "none",
  });
  match.step(cross.startupFrames);
  return match.snapshot().last?.resolution!;
}

describe("live guard resolution", () => {
  it("solid guard reduces impact damage on the hit frame", () => {
    const open = run(false);
    const guarded = run(true);

    expect(guarded.hpDamage).toBeLessThan(open.hpDamage);
    expect(guarded.consciousnessDamage).toBeLessThan(open.consciousnessDamage);
  });
});
