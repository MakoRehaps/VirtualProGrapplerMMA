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

describe("right-stick evasion and counters", () => {
  it("a strong sway evades a head strike and opens a counter window", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const cross = techniqueById("cross")!;

    match.evasionState = (side) =>
      side === "opponent"
        ? { horizontal: 0.8, vertical: 0 }
        : { horizontal: 0, vertical: 0 };

    expect(match.throwTechnique("player", cross, 0, sample)).toBe(true);
    match.step(cross.startupFrames);

    expect(match.lastExchange?.connected).toBe(false);
    expect(match.lastExchange?.missReason).toBe("evaded");
    expect(match.isCounterWindow("opponent", cross.startupFrames)).toBe(true);
  });

  it("head movement does not magically evade body strikes", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const bodyCross = techniqueById("body_cross")!;

    match.evasionState = (side) =>
      side === "opponent"
        ? { horizontal: 0.8, vertical: -0.8 }
        : { horizontal: 0, vertical: 0 };

    expect(match.throwTechnique("player", bodyCross, 0, sample)).toBe(true);
    match.step(bodyCross.startupFrames);

    expect(match.lastExchange?.connected).toBe(true);
    expect(match.lastExchange?.missReason).toBeUndefined();
  });

  it("the next counter strike receives and consumes a two-frame startup advantage", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const cross = techniqueById("cross")!;

    match.evasionState = (side) =>
      side === "opponent"
        ? { horizontal: 0.8, vertical: 0 }
        : { horizontal: 0, vertical: 0 };

    match.throwTechnique("player", cross, 0, sample);
    match.step(cross.startupFrames);

    match.evasionState = () => ({ horizontal: 0, vertical: 0 });
    expect(
      match.throwTechnique("opponent", cross, cross.startupFrames, sample)
    ).toBe(true);

    // Not due one frame before the counter-adjusted landing frame.
    match.step(cross.startupFrames + cross.startupFrames - 3);
    expect(match.lastExchange?.attacker).toBe("player");

    // Due on startup - 2.
    match.step(cross.startupFrames + cross.startupFrames - 2);
    expect(match.lastExchange?.attacker).toBe("opponent");
    expect(match.isCounterWindow("opponent", 999)).toBe(false);
  });
});
