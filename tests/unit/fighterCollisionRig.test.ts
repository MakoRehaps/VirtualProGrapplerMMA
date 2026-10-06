import { describe, expect, it } from "vitest";
import { Vector3 } from "@babylonjs/core";
import {
  firstHitRegion,
  strikeIntersectsHurt,
  type HurtVolume,
  type StrikeVolume,
} from "@/renderer/FighterCollisionRig";

describe("fighter collision math", () => {
  const strike = (x: number, y: number, z: number, radius = 0.1): StrikeVolume => ({
    sourceBone: "rightHand",
    center: new Vector3(x, y, z),
    radius,
  });

  it("detects a strike sphere intersecting a regional sphere", () => {
    const hurt: HurtVolume = {
      region: "head",
      kind: "sphere",
      shape: { center: new Vector3(0, 1.7, 0), radius: 0.16 },
    };
    expect(strikeIntersectsHurt(strike(0.20, 1.7, 0), hurt)).toBe(true);
    expect(strikeIntersectsHurt(strike(0.50, 1.7, 0), hurt)).toBe(false);
  });

  it("detects contact against a limb capsule", () => {
    const hurt: HurtVolume = {
      region: "leftArm",
      kind: "capsule",
      shape: {
        a: new Vector3(0, 1.5, 0),
        b: new Vector3(0, 1.0, 0),
        radius: 0.1,
      },
    };
    expect(strikeIntersectsHurt(strike(0.15, 1.25, 0), hurt)).toBe(true);
    expect(strikeIntersectsHurt(strike(0.5, 1.25, 0), hurt)).toBe(false);
  });

  it("returns the closest intersected regional volume", () => {
    const hurts: HurtVolume[] = [
      {
        region: "body",
        kind: "sphere",
        shape: { center: new Vector3(0.15, 1.35, 0), radius: 0.22 },
      },
      {
        region: "head",
        kind: "sphere",
        shape: { center: new Vector3(0, 1.72, 0), radius: 0.16 },
      },
    ];
    expect(firstHitRegion(strike(0.02, 1.68, 0, 0.12), hurts)).toBe("head");
  });

  it("returns null when no anatomical region is contacted", () => {
    const hurts: HurtVolume[] = [
      {
        region: "rightLeg",
        kind: "capsule",
        shape: {
          a: new Vector3(0, 0.9, 0),
          b: new Vector3(0, 0.45, 0),
          radius: 0.12,
        },
      },
    ];
    expect(firstHitRegion(strike(0, 1.7, 0), hurts)).toBeNull();
  });
});
