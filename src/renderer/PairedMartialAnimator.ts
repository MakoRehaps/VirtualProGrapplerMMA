import {
  Animation,
  AnimationGroup,
  Quaternion,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { motionProfilesForTechnique } from "@/data/combatCatalog";
import { SkeletonRig, type RigBoneId } from "./SkeletonRig";

interface EulerKey {
  t: number;
  pitch?: number;
  yaw?: number;
  roll?: number;
}

interface RootKey {
  t: number;
  position: [number, number, number];
  yaw?: number;
}

function rad(v: number): number {
  return (v * Math.PI) / 180;
}

function q(pitch = 0, yaw = 0, roll = 0): Quaternion {
  return Quaternion.RotationYawPitchRoll(rad(yaw), rad(pitch), rad(roll));
}

export class PairedMartialAnimator {
  private readonly groups = new Map<string, AnimationGroup>();

  constructor(
    private readonly scene: Scene,
    private readonly attackerRoot: TransformNode,
    private readonly attackerRig: SkeletonRig,
    private readonly defenderRoot: TransformNode,
    private readonly defenderRig: SkeletonRig
  ) {}

  buildThrow(
    techniqueId:
      | "osoto_gari"
      | "harai_goshi"
      | "seoi_nage"
      | "inside_trip"
      | "outside_trip"
      | "body_lock_trip"
      | "double_leg"
      | "single_leg"
      | "high_crotch"
  ): AnimationGroup | null {
    const existing = this.groups.get(techniqueId);
    if (existing) return existing;

    const profile = motionProfilesForTechnique(techniqueId)[0] as any;
    const synthesized = !profile && [
      "inside_trip",
      "outside_trip",
      "body_lock_trip",
      "double_leg",
      "single_leg",
      "high_crotch",
    ].includes(techniqueId);
    if (!profile && !synthesized) return null;

    const group = new AnimationGroup(`PAIR_${techniqueId}`, this.scene);

    if (techniqueId === "osoto_gari") {
      this.buildOsoto(group, profile);
    } else if (techniqueId === "harai_goshi") {
      this.buildHarai(group, profile);
    } else if (techniqueId === "seoi_nage") {
      this.buildSeoi(group, profile);
    } else if (techniqueId === "inside_trip") {
      this.buildInsideTrip(group);
    } else if (techniqueId === "outside_trip") {
      this.buildOutsideTrip(group);
    } else if (techniqueId === "body_lock_trip") {
      this.buildBodyLockTrip(group);
    } else if (techniqueId === "double_leg") {
      this.buildDoubleLeg(group);
    } else if (techniqueId === "single_leg") {
      this.buildSingleLeg(group);
    } else {
      this.buildHighCrotch(group);
    }

    if (!group.targetedAnimations.length) {
      group.dispose();
      return null;
    }

    this.groups.set(techniqueId, group);
    return group;
  }

  private addBone(
    group: AnimationGroup,
    rig: SkeletonRig,
    id: RigBoneId,
    keys: EulerKey[],
    durationFrames = 60
  ): void {
    const binding = rig.get(id);
    const node = binding?.node;
    if (!binding || !node) return;

    if (!node.rotationQuaternion) node.rotationQuaternion = binding.restRotation.clone();

    const anim = new Animation(
      `${group.name}_${id}_${node.name}`,
      "rotationQuaternion",
      60,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    anim.setKeys(
      keys.map((k) => ({
        frame: Math.round(k.t * durationFrames),
        value: binding.restRotation.multiply(q(k.pitch, k.yaw, k.roll)),
      }))
    );
    group.addTargetedAnimation(anim, node);
  }

  private addRoot(
    group: AnimationGroup,
    root: TransformNode,
    keys: RootKey[],
    durationFrames = 60
  ): void {
    if (!root.rotationQuaternion) {
      root.rotationQuaternion = Quaternion.FromEulerVector(root.rotation);
    }

    const basePos = root.position.clone();
    const baseRot = root.rotationQuaternion.clone();

    const pos = new Animation(
      `${group.name}_${root.name}_position`,
      "position",
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    pos.setKeys(
      keys.map((k) => ({
        frame: Math.round(k.t * durationFrames),
        value: basePos.add(new Vector3(...k.position)),
      }))
    );

    const rot = new Animation(
      `${group.name}_${root.name}_rotation`,
      "rotationQuaternion",
      60,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    rot.setKeys(
      keys.map((k) => ({
        frame: Math.round(k.t * durationFrames),
        value: baseRot.multiply(q(0, k.yaw ?? 0, 0)),
      }))
    );

    group.addTargetedAnimation(pos, root);
    group.addTargetedAnimation(rot, root);
  }

  private buildOsoto(group: AnimationGroup, profile: any): void {
    const duration = 72;

    this.addBone(group, this.attackerRig, "chest", [
      { t: 0, yaw: 0 },
      { t: 0.32, yaw: -18 },
      { t: 0.62, yaw: -34 },
      { t: 1, yaw: -6 },
    ], duration);
    this.addBone(group, this.attackerRig, "rightThigh", [
      { t: 0, pitch: 0 },
      { t: 0.42, pitch: -18 },
      { t: 0.68, pitch: 32, roll: 18 },
      { t: 0.82, pitch: 68, roll: 24 },
      { t: 1, pitch: 10 },
    ], duration);
    this.addBone(group, this.attackerRig, "rightShin", [
      { t: 0, pitch: 0 },
      { t: 0.48, pitch: 16 },
      { t: 0.72, pitch: 8 },
      { t: 1, pitch: 0 },
    ], duration);

    this.addBone(group, this.defenderRig, "chest", [
      { t: 0, pitch: 0 },
      { t: 0.30, pitch: -8, roll: 8 },
      { t: 0.58, pitch: -22, roll: 18 },
      { t: 0.78, pitch: -56, roll: 42 },
      { t: 1, pitch: -78, roll: 58 },
    ], duration);
    this.addRoot(group, this.defenderRoot, [
      { t: 0, position: [0, 0, 0], yaw: 0 },
      { t: 0.35, position: [0, 0, -0.10], yaw: 0 },
      { t: 0.68, position: [0.08, 0.10, -0.24], yaw: 8 },
      { t: 0.84, position: [0.20, 0.24, -0.45], yaw: 22 },
      { t: 1, position: [0.34, 0.08, -0.64], yaw: 48 },
    ], duration);
  }

  private buildHarai(group: AnimationGroup, profile: any): void {
    const duration = 76;

    this.addBone(group, this.attackerRig, "hips", [
      { t: 0, yaw: 0 },
      { t: 0.30, yaw: -26 },
      { t: 0.62, yaw: -62 },
      { t: 0.78, yaw: -78 },
      { t: 1, yaw: -32 },
    ], duration);
    this.addBone(group, this.attackerRig, "rightThigh", [
      { t: 0, pitch: 0 },
      { t: 0.50, pitch: -24 },
      { t: 0.70, pitch: 46, roll: 30 },
      { t: 0.84, pitch: 78, roll: 42 },
      { t: 1, pitch: 24 },
    ], duration);

    this.addBone(group, this.defenderRig, "chest", [
      { t: 0, pitch: 0 },
      { t: 0.30, pitch: 12, yaw: 12 },
      { t: 0.62, pitch: 30, yaw: 34, roll: 22 },
      { t: 0.82, pitch: 66, yaw: 50, roll: 48 },
      { t: 1, pitch: 84, yaw: 54, roll: 64 },
    ], duration);
    this.addRoot(group, this.defenderRoot, [
      { t: 0, position: [0, 0, 0], yaw: 0 },
      { t: 0.35, position: [0, 0, -0.12], yaw: 8 },
      { t: 0.65, position: [0.08, 0.18, -0.30], yaw: 26 },
      { t: 0.84, position: [0.28, 0.36, -0.52], yaw: 56 },
      { t: 1, position: [0.50, 0.10, -0.70], yaw: 82 },
    ], duration);
  }

  private buildSeoi(group: AnimationGroup, profile: any): void {
    const duration = 78;

    this.addBone(group, this.attackerRig, "hips", [
      { t: 0, yaw: 0 },
      { t: 0.28, yaw: -30 },
      { t: 0.55, yaw: -86 },
      { t: 0.72, yaw: -128 },
      { t: 1, yaw: -150 },
    ], duration);
    this.addBone(group, this.attackerRig, "chest", [
      { t: 0, pitch: 0, yaw: 0 },
      { t: 0.34, pitch: 8, yaw: -30 },
      { t: 0.64, pitch: 34, yaw: -74 },
      { t: 0.82, pitch: 58, yaw: -96 },
      { t: 1, pitch: 26, yaw: -72 },
    ], duration);

    this.addBone(group, this.defenderRig, "hips", [
      { t: 0, pitch: 0 },
      { t: 0.38, pitch: -10 },
      { t: 0.66, pitch: -28 },
      { t: 0.80, pitch: -62 },
      { t: 1, pitch: -88 },
    ], duration);
    this.addRoot(group, this.defenderRoot, [
      { t: 0, position: [0, 0, 0], yaw: 0 },
      { t: 0.38, position: [0, 0.06, -0.12], yaw: 10 },
      { t: 0.62, position: [0, 0.32, -0.28], yaw: 28 },
      { t: 0.82, position: [0.10, 0.62, -0.46], yaw: 64 },
      { t: 1, position: [0.34, 0.12, -0.72], yaw: 108 },
    ], duration);
  }

  private buildDoubleLeg(group: AnimationGroup): void {
    const duration = 60;

    this.addBone(group, this.attackerRig, "chest", [
      { t: 0, pitch: 0 },
      { t: 0.25, pitch: 24 },
      { t: 0.52, pitch: 42 },
      { t: 0.78, pitch: 34 },
      { t: 1, pitch: 12 },
    ], duration);
    this.addBone(group, this.attackerRig, "hips", [
      { t: 0, pitch: 0 },
      { t: 0.28, pitch: 12 },
      { t: 0.58, pitch: 24 },
      { t: 0.82, pitch: 18 },
      { t: 1, pitch: 6 },
    ], duration);
    this.addBone(group, this.attackerRig, "leftUpperArm", [
      { t: 0, pitch: 0 },
      { t: 0.36, pitch: -46, roll: -30 },
      { t: 0.64, pitch: -68, roll: -46 },
      { t: 1, pitch: -22, roll: -10 },
    ], duration);
    this.addBone(group, this.attackerRig, "rightUpperArm", [
      { t: 0, pitch: 0 },
      { t: 0.36, pitch: -46, roll: 30 },
      { t: 0.64, pitch: -68, roll: 46 },
      { t: 1, pitch: -22, roll: 10 },
    ], duration);

    this.addBone(group, this.defenderRig, "hips", [
      { t: 0, pitch: 0 },
      { t: 0.44, pitch: -10 },
      { t: 0.70, pitch: -34 },
      { t: 1, pitch: -72 },
    ], duration);
    this.addBone(group, this.defenderRig, "chest", [
      { t: 0, pitch: 0 },
      { t: 0.44, pitch: -8 },
      { t: 0.72, pitch: -28 },
      { t: 1, pitch: -64 },
    ], duration);
    this.addRoot(group, this.defenderRoot, [
      { t: 0, position: [0, 0, 0], yaw: 0 },
      { t: 0.42, position: [0, 0.04, -0.10], yaw: 0 },
      { t: 0.70, position: [0, 0.22, -0.32], yaw: 0 },
      { t: 1, position: [0, 0.08, -0.66], yaw: 0 },
    ], duration);
  }

  private buildSingleLeg(group: AnimationGroup): void {
    const duration = 62;

    this.addBone(group, this.attackerRig, "chest", [
      { t: 0, pitch: 0 },
      { t: 0.28, pitch: 22, yaw: -8 },
      { t: 0.58, pitch: 38, yaw: -16 },
      { t: 0.82, pitch: 28, yaw: -22 },
      { t: 1, pitch: 10, yaw: -8 },
    ], duration);
    this.addBone(group, this.attackerRig, "rightUpperArm", [
      { t: 0, pitch: 0 },
      { t: 0.38, pitch: -50, roll: 28 },
      { t: 0.66, pitch: -72, roll: 46 },
      { t: 1, pitch: -20, roll: 8 },
    ], duration);
    this.addBone(group, this.defenderRig, "rightThigh", [
      { t: 0, pitch: 0 },
      { t: 0.44, pitch: -14 },
      { t: 0.68, pitch: -36, roll: 12 },
      { t: 1, pitch: -58, roll: 18 },
    ], duration);
    this.addRoot(group, this.defenderRoot, [
      { t: 0, position: [0, 0, 0], yaw: 0 },
      { t: 0.42, position: [0.02, 0.08, -0.10], yaw: 4 },
      { t: 0.72, position: [0.14, 0.22, -0.30], yaw: 18 },
      { t: 1, position: [0.30, 0.08, -0.58], yaw: 42 },
    ], duration);
  }

  private buildHighCrotch(group: AnimationGroup): void {
    const duration = 64;

    this.addBone(group, this.attackerRig, "hips", [
      { t: 0, yaw: 0 },
      { t: 0.30, yaw: -16 },
      { t: 0.60, yaw: -34 },
      { t: 0.84, yaw: -52 },
      { t: 1, yaw: -20 },
    ], duration);
    this.addBone(group, this.attackerRig, "chest", [
      { t: 0, pitch: 0 },
      { t: 0.28, pitch: 20, yaw: -10 },
      { t: 0.58, pitch: 34, yaw: -28 },
      { t: 0.82, pitch: 24, yaw: -44 },
      { t: 1, pitch: 8, yaw: -18 },
    ], duration);
    this.addBone(group, this.defenderRig, "hips", [
      { t: 0, pitch: 0, roll: 0 },
      { t: 0.44, pitch: -8, roll: 8 },
      { t: 0.72, pitch: -26, roll: 28 },
      { t: 1, pitch: -62, roll: 54 },
    ], duration);
    this.addRoot(group, this.defenderRoot, [
      { t: 0, position: [0, 0, 0], yaw: 0 },
      { t: 0.44, position: [0.04, 0.10, -0.12], yaw: 8 },
      { t: 0.72, position: [0.18, 0.30, -0.34], yaw: 28 },
      { t: 1, position: [0.42, 0.10, -0.62], yaw: 66 },
    ], duration);
  }

  private buildInsideTrip(group: AnimationGroup): void {
    const duration = 54;

    this.addBone(group, this.attackerRig, "hips", [
      { t: 0, yaw: 0 },
      { t: 0.28, yaw: -12 },
      { t: 0.62, yaw: -24 },
      { t: 1, yaw: -8 },
    ], duration);
    this.addBone(group, this.attackerRig, "rightThigh", [
      { t: 0, pitch: 0 },
      { t: 0.30, pitch: -20, roll: 10 },
      { t: 0.58, pitch: 28, roll: -18 },
      { t: 0.78, pitch: 54, roll: -28 },
      { t: 1, pitch: 8 },
    ], duration);
    this.addBone(group, this.defenderRig, "hips", [
      { t: 0, roll: 0 },
      { t: 0.40, roll: 8 },
      { t: 0.68, roll: 26, pitch: -10 },
      { t: 1, roll: 58, pitch: -46 },
    ], duration);
    this.addRoot(group, this.defenderRoot, [
      { t: 0, position: [0, 0, 0], yaw: 0 },
      { t: 0.45, position: [0.02, 0, -0.08], yaw: 0 },
      { t: 0.72, position: [0.12, 0.12, -0.26], yaw: 12 },
      { t: 1, position: [0.30, 0.06, -0.52], yaw: 42 },
    ], duration);
  }

  private buildOutsideTrip(group: AnimationGroup): void {
    const duration = 56;

    this.addBone(group, this.attackerRig, "hips", [
      { t: 0, yaw: 0 },
      { t: 0.28, yaw: 12 },
      { t: 0.62, yaw: 28 },
      { t: 1, yaw: 10 },
    ], duration);
    this.addBone(group, this.attackerRig, "leftThigh", [
      { t: 0, pitch: 0 },
      { t: 0.30, pitch: -18, roll: -10 },
      { t: 0.58, pitch: 30, roll: 20 },
      { t: 0.78, pitch: 58, roll: 30 },
      { t: 1, pitch: 8 },
    ], duration);
    this.addBone(group, this.defenderRig, "hips", [
      { t: 0, roll: 0 },
      { t: 0.40, roll: -8 },
      { t: 0.68, roll: -26, pitch: -12 },
      { t: 1, roll: -60, pitch: -48 },
    ], duration);
    this.addRoot(group, this.defenderRoot, [
      { t: 0, position: [0, 0, 0], yaw: 0 },
      { t: 0.45, position: [-0.02, 0, -0.08], yaw: 0 },
      { t: 0.72, position: [-0.12, 0.12, -0.26], yaw: -12 },
      { t: 1, position: [-0.30, 0.06, -0.52], yaw: -42 },
    ], duration);
  }

  private buildBodyLockTrip(group: AnimationGroup): void {
    const duration = 62;

    this.addBone(group, this.attackerRig, "chest", [
      { t: 0, pitch: 0 },
      { t: 0.26, pitch: 10 },
      { t: 0.58, pitch: 24, yaw: -12 },
      { t: 0.82, pitch: 34, yaw: -22 },
      { t: 1, pitch: 10, yaw: -8 },
    ], duration);
    this.addBone(group, this.attackerRig, "leftUpperArm", [
      { t: 0, pitch: -28, roll: -30 },
      { t: 0.45, pitch: -46, roll: -52 },
      { t: 0.78, pitch: -54, roll: -58 },
      { t: 1, pitch: -24, roll: -18 },
    ], duration);
    this.addBone(group, this.attackerRig, "rightUpperArm", [
      { t: 0, pitch: -28, roll: 30 },
      { t: 0.45, pitch: -46, roll: 52 },
      { t: 0.78, pitch: -54, roll: 58 },
      { t: 1, pitch: -24, roll: 18 },
    ], duration);
    this.addBone(group, this.defenderRig, "chest", [
      { t: 0, pitch: 8 },
      { t: 0.36, pitch: 20 },
      { t: 0.68, pitch: 46, roll: 22 },
      { t: 1, pitch: 76, roll: 48 },
    ], duration);
    this.addRoot(group, this.defenderRoot, [
      { t: 0, position: [0, 0, 0], yaw: 0 },
      { t: 0.40, position: [0, 0.06, -0.12], yaw: 4 },
      { t: 0.72, position: [0.10, 0.28, -0.32], yaw: 20 },
      { t: 1, position: [0.34, 0.08, -0.62], yaw: 58 },
    ], duration);
  }

  dispose(): void {
    for (const group of this.groups.values()) group.dispose();
    this.groups.clear();
  }
}
