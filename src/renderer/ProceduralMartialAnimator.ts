import {
  Animation,
  AnimationGroup,
  Quaternion,
  Scene,
} from "@babylonjs/core";
import { motionProfilesForTechnique } from "@/data/combatCatalog";
import { SkeletonRig, type RigBoneId } from "./SkeletonRig";

interface EulerKey {
  t: number;
  pitch: number;
  yaw: number;
  roll: number;
}

function deg(v: number): number {
  return (v * Math.PI) / 180;
}

function qFromDegrees(pitch: number, yaw: number, roll: number): Quaternion {
  return Quaternion.RotationYawPitchRoll(deg(yaw), deg(pitch), deg(roll));
}

function multiplyRest(rest: Quaternion, delta: Quaternion): Quaternion {
  return rest.multiply(delta);
}

export class ProceduralMartialAnimator {
  private readonly created = new Map<string, AnimationGroup>();

  constructor(
    private readonly scene: Scene,
    private readonly rig: SkeletonRig
  ) {}

  get clipNames(): string[] {
    return [...this.created.keys()];
  }

  buildTechnique(
    techniqueId: string,
    preferredFamily?: string
  ): AnimationGroup | null {
    const profiles = motionProfilesForTechnique(techniqueId);
    if (!profiles.length) return null;

    const profile =
      profiles.find((p) => p.family === preferredFamily) ??
      profiles[0];

    const clipName = `PROC_${techniqueId}_${profile.family}`;
    const existing = this.created.get(clipName);
    if (existing) return existing;

    const group = new AnimationGroup(clipName, this.scene);

    if (techniqueId === "jab") {
      this.buildLeadStraight(group, profile);
    } else if (techniqueId === "cross") {
      this.buildRearStraight(group, profile);
    } else if (
      techniqueId === "round_kick_body" ||
      techniqueId === "round_kick_head" ||
      techniqueId === "low_kick"
    ) {
      this.buildRoundKick(group, profile, techniqueId);
    } else if (techniqueId === "side_kick") {
      this.buildSideKick(group, profile);
    } else {
      return null;
    }

    if (!group.targetedAnimations.length) {
      group.dispose();
      return null;
    }

    this.created.set(clipName, group);
    return group;
  }

  buildDefaultSet(): AnimationGroup[] {
    const out: AnimationGroup[] = [];
    for (const technique of [
      "jab",
      "cross",
      "round_kick_body",
      "round_kick_head",
      "low_kick",
      "side_kick",
    ]) {
      const profiles = motionProfilesForTechnique(technique);
      for (const profile of profiles) {
        const group = this.buildTechnique(technique, profile.family);
        if (group && !out.includes(group)) out.push(group);
      }
    }
    return out;
  }

  private addBone(
    group: AnimationGroup,
    boneId: RigBoneId,
    keys: EulerKey[],
    fps = 60
  ): void {
    const binding = this.rig.get(boneId);
    const node = binding?.node;
    if (!binding || !node) return;

    if (!node.rotationQuaternion) {
      node.rotationQuaternion = binding.restRotation.clone();
    }

    const animation = new Animation(
      `${group.name}_${boneId}`,
      "rotationQuaternion",
      fps,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    animation.setKeys(
      keys.map((k) => ({
        frame: Math.round(k.t * fps),
        value: multiplyRest(
          binding.restRotation,
          qFromDegrees(k.pitch, k.yaw, k.roll)
        ),
      }))
    );

    group.addTargetedAnimation(animation, node);
  }

  private durationFrames(profile: any, fallbackSeconds: number): number {
    const seconds =
      profile?.duration_s?.mean ??
      profile?.duration_s?.nominal ??
      fallbackSeconds;
    return Math.max(12, Math.round(seconds * 60));
  }

  private normalizedKeys(
    profile: any,
    values: Array<[number, number, number, number]>
  ): EulerKey[] {
    const duration = this.durationFrames(profile, 0.7);
    return values.map(([t, pitch, yaw, roll]) => ({
      t: (t * duration) / 60,
      pitch,
      yaw,
      roll,
    }));
  }

  private buildLeadStraight(group: AnimationGroup, profile: any): void {
    const trunkRom = profile?.kinematics?.trunk_rotation_rom_deg?.mean ?? 40;

    this.addBone(
      group,
      "chest",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.30, 0, trunkRom * 0.18, 0],
        [0.62, 0, trunkRom * 0.48, 0],
        [0.88, 0, trunkRom * 0.58, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "leftUpperArm",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.38, -18, -6, -8],
        [0.72, -62, -10, -5],
        [0.88, -78, -8, -2],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "leftForearm",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.42, 32, 0, 0],
        [0.72, 10, 0, 0],
        [0.88, 2, 0, 0],
        [1.00, 0, 0, 0],
      ])
    );
  }

  private buildRearStraight(group: AnimationGroup, profile: any): void {
    const trunkRom = profile?.kinematics?.trunk_rotation_rom_deg?.mean ?? 70;

    this.addBone(
      group,
      "hips",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.20, 0, -trunkRom * 0.16, 0],
        [0.50, 0, -trunkRom * 0.42, 0],
        [0.86, 0, -trunkRom * 0.48, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "chest",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.30, 0, -trunkRom * 0.20, 0],
        [0.58, 0, -trunkRom * 0.55, 0],
        [0.86, 0, -trunkRom * 0.68, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightUpperArm",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.40, -22, 8, 8],
        [0.66, -66, 12, 4],
        [0.86, -82, 8, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightForearm",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.40, 38, 0, 0],
        [0.66, 12, 0, 0],
        [0.86, 2, 0, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightFoot",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.20, 0, -10, 0],
        [0.55, 0, -28, 0],
        [0.86, 0, -34, 0],
        [1.00, 0, 0, 0],
      ])
    );
  }

  private buildRoundKick(
    group: AnimationGroup,
    profile: any,
    techniqueId: string
  ): void {
    const k = profile?.kinematics ?? {};
    const pelvisRom = k.pelvis_axial_rotation_rom_deg?.mean ?? 100;
    const chamber = k.max_knee_flexion_deg?.mean ?? 98;
    const impactKnee = k.knee_flexion_at_impact_deg?.mean ?? 25;
    const hipAbduction = k.hip_abduction_at_impact_deg?.mean ?? 50;

    const heightPitch =
      techniqueId === "round_kick_head"
        ? -35
        : techniqueId === "low_kick"
          ? 18
          : -5;

    this.addBone(
      group,
      "hips",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.20, 0, -pelvisRom * 0.16, 0],
        [0.55, 0, -pelvisRom * 0.58, 0],
        [0.82, 0, -pelvisRom * 0.82, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "leftFoot",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.18, 0, -28, 0],
        [0.48, 0, -72, 0],
        [0.82, 0, -96, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightThigh",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.28, -22 + heightPitch, 0, -18],
        [0.52, -54 + heightPitch, 0, -hipAbduction * 0.75],
        [0.82, -76 + heightPitch, 0, -hipAbduction],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightShin",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.38, chamber * 0.75, 0, 0],
        [0.58, chamber, 0, 0],
        [0.82, impactKnee, 0, 0],
        [1.00, 0, 0, 0],
      ])
    );
  }

  private buildSideKick(group: AnimationGroup, profile: any): void {
    const supportPivot =
      profile?.kinematics?.support_foot_rotation_deg?.min ?? 95;
    const chamber =
      profile?.kinematics?.chamber_knee_flexion_deg?.max ?? 120;

    this.addBone(
      group,
      "leftFoot",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.18, 0, -supportPivot * 0.45, 0],
        [0.58, 0, -supportPivot, 0],
        [0.86, 0, -supportPivot, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightThigh",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.34, -62, 0, -26],
        [0.58, -78, 0, -42],
        [0.84, -88, 0, -54],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightShin",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.34, chamber, 0, 0],
        [0.58, chamber * 0.60, 0, 0],
        [0.84, 8, 0, 0],
        [1.00, 0, 0, 0],
      ])
    );
  }

  dispose(): void {
    for (const group of this.created.values()) group.dispose();
    this.created.clear();
  }
}
