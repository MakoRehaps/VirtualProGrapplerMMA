import { describe, expect, it } from "vitest";
import { createFighterState, type FighterLoadout } from "@/combat/mayQuvTypes";
import { resolveSubmission } from "@/combat/submission";
import { techniqueById } from "@/data/combatCatalog";

const loadout: FighterLoadout = {
  id: "test",
  name: "Test",
  styleId: "brazilian_jiu_jitsu",
  stanceId: "submission_grappler",
  body: {
    massKg: 77,
    heightM: 1.78,
    reachM: 1.81,
    centerOfMassHeightRatio: 0.56,
  },
};

describe("submission resolver", () => {
  it("lets a fresh defender resist a joint lock", () => {
    const attacker = createFighterState(loadout);
    const defender = createFighterState(loadout);
    const armbar = techniqueById("armbar")!;

    const result = resolveSubmission(attacker, defender, armbar);

    expect(result.tapped).toBe(false);
    expect(result.targetRegion).toBe("leftArm");
    expect(defender.condition.regions.leftArm).toBeLessThan(100);
  });

  it("taps an exhausted defender with a badly damaged target region", () => {
    const attacker = createFighterState(loadout);
    const defender = createFighterState(loadout);
    const armbar = techniqueById("armbar")!;

    attacker.condition.stamina = 90;
    defender.condition.stamina = 5;
    defender.condition.regions.leftArm = 15;

    const result = resolveSubmission(attacker, defender, armbar);

    expect(result.tapped).toBe(true);
    expect(result.pressure).toBeGreaterThan(result.escapeCapacity);
  });

  it("chokes damage consciousness when the defender does not tap", () => {
    const attacker = createFighterState(loadout);
    const defender = createFighterState(loadout);
    const choke = techniqueById("rear_naked_choke")!;

    const before = defender.condition.consciousness;
    const result = resolveSubmission(attacker, defender, choke);

    expect(result.consciousnessDamage).toBeGreaterThan(0);
    expect(defender.condition.consciousness).toBeLessThan(before);
  });

  it("uses existing arm condition rather than hidden submission stats", () => {
    const healthy = createFighterState(loadout);
    const damaged = createFighterState(loadout);
    const attackerA = createFighterState(loadout);
    const attackerB = createFighterState(loadout);
    const kimura = techniqueById("kimura")!;

    damaged.condition.regions.leftArm = 30;

    const a = resolveSubmission(attackerA, healthy, kimura);
    const b = resolveSubmission(attackerB, damaged, kimura);

    expect(b.pressure).toBeGreaterThan(a.pressure);
    expect(b.escapeCapacity).toBeLessThan(a.escapeCapacity);
  });
});
