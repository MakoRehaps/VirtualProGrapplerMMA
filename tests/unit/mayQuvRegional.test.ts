import { describe, expect, it } from "vitest";
import { createFighterState, freshCondition, type FighterLoadout } from "@/combat/mayQuvTypes";
import { regionConsequences, regionFromTarget } from "@/combat/regionalCondition";
import { EventConditionStore } from "@/competition/EventConditionStore";

const loadout: FighterLoadout = {
  id: "test",
  name: "Test",
  styleId: "boxing",
  stanceId: "boxing_orthodox",
  body: {
    massKg: 77,
    heightM: 1.78,
    reachM: 1.81,
    centerOfMassHeightRatio: 0.56,
  },
};

describe("MAY' QUV regional condition", () => {
  it("starts every region and core condition at 100", () => {
    const state = createFighterState(loadout);
    expect(state.condition.hp).toBe(100);
    expect(state.condition.stamina).toBe(100);
    expect(state.condition.consciousness).toBe(100);
    expect(state.condition.balance).toBe(100);
    expect(state.condition.regions).toEqual({
      head: 100,
      body: 100,
      leftArm: 100,
      rightArm: 100,
      leftLeg: 100,
      rightLeg: 100,
    });
  });

  it("maps targets into six persistent regions", () => {
    expect(regionFromTarget("head")).toBe("head");
    expect(regionFromTarget("neck")).toBe("head");
    expect(regionFromTarget("torso")).toBe("body");
    expect(regionFromTarget("left_arm")).toBe("leftArm");
    expect(regionFromTarget("right_leg")).toBe("rightLeg");
  });

  it("head wear increases susceptibility and body wear increases stamina cost", () => {
    const c = freshCondition();
    c.regions.head = 40;
    c.regions.body = 50;
    const effects = regionConsequences(c);
    expect(effects.koRiskScale).toBeGreaterThan(1);
    expect(effects.staminaCostScale).toBeGreaterThan(1);
  });

  it("leg wear lowers movement and balance scales", () => {
    const c = freshCondition();
    c.regions.leftLeg = 25;
    const effects = regionConsequences(c);
    expect(effects.movementScale).toBeLessThan(1);
    expect(effects.balanceScale).toBeLessThan(1);
  });

  it("arm wear lowers only the matching arm output scale", () => {
    const c = freshCondition();
    c.regions.leftArm = 20;
    const effects = regionConsequences(c);
    expect(effects.leftArmScale).toBeLessThan(effects.rightArmScale);
  });
});

describe("event regional carryover", () => {
  it("normal multiplayer always starts fresh", () => {
    const store = new EventConditionStore();
    const used = freshCondition();
    used.regions.head = 10;
    store.finishFight("normal_mp", used);
    expect(store.startCondition("normal_mp").regions.head).toBe(100);
  });

  it("weekly event chain preserves regional condition", () => {
    const store = new EventConditionStore();
    const used = freshCondition();
    used.regions.leftLeg = 42;
    store.finishFight("weekly_qualifier", used);
    expect(store.startCondition("weekly_tournament").regions.leftLeg).toBe(42);
  });

  it("monthly chain preserves both qualifier stages", () => {
    const store = new EventConditionStore();
    const used = freshCondition();
    used.regions.body = 61;
    store.finishFight("monthly_qualifier_one", used);
    expect(store.startCondition("monthly_qualifier_two").regions.body).toBe(61);
    expect(store.startCondition("monthly_grand_tournament").regions.body).toBe(61);
  });
});
