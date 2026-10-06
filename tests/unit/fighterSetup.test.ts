import { describe, expect, it } from "vitest";
import { normalizeFighterSetup } from "@/game/fighterSetup";

describe("fighter setup normalization", () => {
  it("clamps height and mass to the global legal envelope", () => {
    const low = normalizeFighterSetup("a", {
      name: "Low",
      styleId: "boxing",
      stanceId: "boxing_orthodox",
      body: {
        massKg: 20,
        heightM: 1.1,
        reachM: 1.0,
        centerOfMassHeightRatio: 0.4,
      },
    });

    const high = normalizeFighterSetup("b", {
      name: "High",
      styleId: "boxing",
      stanceId: "boxing_orthodox",
      body: {
        massKg: 300,
        heightM: 2.6,
        reachM: 3.5,
        centerOfMassHeightRatio: 0.8,
      },
    });

    expect(low.body.massKg).toBe(45);
    expect(low.body.heightM).toBe(1.5);
    expect(high.body.massKg).toBe(160);
    expect(high.body.heightM).toBe(2.1);
  });

  it("clamps reach from the normalized height ratio", () => {
    const shortReach = normalizeFighterSetup("a", {
      styleId: "boxing",
      stanceId: "boxing_orthodox",
      body: {
        massKg: 77,
        heightM: 2,
        reachM: 1,
        centerOfMassHeightRatio: 0.56,
      },
    });

    const longReach = normalizeFighterSetup("b", {
      styleId: "boxing",
      stanceId: "boxing_orthodox",
      body: {
        massKg: 77,
        heightM: 2,
        reachM: 3,
        centerOfMassHeightRatio: 0.56,
      },
    });

    expect(shortReach.body.reachM).toBeCloseTo(1.8);
    expect(longReach.body.reachM).toBeCloseTo(2.24);
  });

  it("clamps center of mass and enforces the style default stance", () => {
    const fighter = normalizeFighterSetup("a", {
      styleId: "judo",
      stanceId: "boxing_orthodox",
      body: {
        massKg: 80,
        heightM: 1.8,
        reachM: 1.8,
        centerOfMassHeightRatio: 0.9,
      },
    });

    expect(fighter.body.centerOfMassHeightRatio).toBe(0.62);
    expect(fighter.stanceId).toBe("judo_grip_ready");
  });

  it("falls back to boxing for an unknown style", () => {
    const fighter = normalizeFighterSetup("a", {
      styleId: "does_not_exist",
      stanceId: "anything",
      body: {
        massKg: 77,
        heightM: 1.78,
        reachM: 1.81,
        centerOfMassHeightRatio: 0.56,
      },
    });

    expect(fighter.styleId).toBe("boxing");
    expect(fighter.stanceId).toBe("boxing_orthodox");
  });
});
