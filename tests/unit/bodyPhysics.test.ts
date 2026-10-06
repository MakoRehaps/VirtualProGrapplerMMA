import { describe, expect, it } from "vitest";
import { clampFighterBody, validateFighterBody } from "@/game/bodyPhysics";
import { BODY_PHYSICS } from "@/data/combatCatalog";

describe("continuous fighter body physics", () => {
  it("has no weight classes", () => {
    expect(BODY_PHYSICS.invariants.weight_classes).toBe(false);
    expect("body_classes" in BODY_PHYSICS).toBe(false);
  });

  it("accepts bodies inside the global legal envelope", () => {
    expect(validateFighterBody({
      massKg: 77,
      heightM: 1.78,
      reachM: 1.81,
      centerOfMassHeightRatio: 0.56,
    }).valid).toBe(true);
  });

  it("rejects out-of-range height and weight", () => {
    expect(validateFighterBody({
      massKg: 200,
      heightM: 2.3,
      reachM: 2.3,
      centerOfMassHeightRatio: 0.56,
    }).valid).toBe(false);
  });

  it("clamps generated bodies to legal bounds", () => {
    const c = clampFighterBody({
      massKg: 999,
      heightM: 9,
      reachM: 9,
      centerOfMassHeightRatio: 1,
    });
    expect(c.massKg).toBe(BODY_PHYSICS.legal_body_envelope.max_mass_kg);
    expect(c.heightM).toBe(BODY_PHYSICS.legal_body_envelope.max_height_m);
  });
});
