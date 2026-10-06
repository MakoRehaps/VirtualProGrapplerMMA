import { describe, expect, it } from "vitest";
import {
  canSustainWhizzer,
  guardLevelFromArmCondition,
} from "@/combat/regionalCondition";
import { freshCondition } from "@/combat/mayQuvTypes";

describe("arm damage defensive consequences", () => {
  it("keeps solid guard with healthy arms", () => {
    const condition = freshCondition();
    expect(guardLevelFromArmCondition(condition, "solid")).toBe("solid");
  });

  it("downgrades solid guard to partial with moderate arm damage", () => {
    const condition = freshCondition();
    condition.regions.leftArm = 45;
    condition.regions.rightArm = 45;

    expect(guardLevelFromArmCondition(condition, "solid")).toBe("partial");
  });

  it("removes effective guard with severe bilateral arm damage", () => {
    const condition = freshCondition();
    condition.regions.leftArm = 15;
    condition.regions.rightArm = 20;

    expect(guardLevelFromArmCondition(condition, "solid")).toBe("none");
    expect(guardLevelFromArmCondition(condition, "partial")).toBe("none");
  });

  it("allows a whizzer if at least one arm can still control strongly", () => {
    const condition = freshCondition();
    condition.regions.leftArm = 20;
    condition.regions.rightArm = 60;

    expect(canSustainWhizzer(condition)).toBe(true);
  });

  it("prevents a full whizzer when both arms are badly compromised", () => {
    const condition = freshCondition();
    condition.regions.leftArm = 20;
    condition.regions.rightArm = 30;

    expect(canSustainWhizzer(condition)).toBe(false);
  });
});
