import { describe, expect, it } from "vitest";
import {
  martialPoseById,
  motionProfilesForTechnique,
  preferredBiomechPoseForStyle,
} from "@/data/combatCatalog";

describe("martial animation catalog", () => {
  it("returns measured karate stance profiles", () => {
    const pose = martialPoseById("karate_zenkutsu_dachi");
    expect(pose?.family).toBe("karate");
    expect(pose?.geometry.rear_foot_yaw_deg.nominal).toBe(30);
  });

  it("has style-specific round kick profiles", () => {
    const profiles = motionProfilesForTechnique("round_kick_body");
    const families = new Set(profiles.map((p) => p.family));
    expect(families.has("muay_thai")).toBe(true);
    expect(families.has("karate")).toBe(true);
    expect(families.has("taekwondo")).toBe(true);
  });

  it("routes karate styles to a source-backed stance pose", () => {
    const pose = preferredBiomechPoseForStyle("shotokan");
    if (pose !== null) {
      expect(pose.startsWith("karate_")).toBe(true);
    }
  });

  it("keeps boxing rear straight biomechanics distinct from lead straight", () => {
    const jab = motionProfilesForTechnique("jab")[0];
    const cross = motionProfilesForTechnique("cross")[0];
    expect(jab).toBeTruthy();
    expect(cross).toBeTruthy();
    expect(
      cross.kinematics.trunk_rotation_rom_deg.mean
    ).toBeGreaterThan(jab.kinematics.trunk_rotation_rom_deg.mean);
  });
});
