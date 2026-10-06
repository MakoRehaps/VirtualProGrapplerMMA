import {
  Animation,
  AnimationGroup,
  Quaternion,
  Scene,
} from "@babylonjs/core";
import { martialPoseById } from "@/data/combatCatalog";
import { SkeletonRig, type RigBoneId } from "./SkeletonRig";

interface BoneEuler {
  bone: RigBoneId;
  pitch?: number;
  yaw?: number;
  roll?: number;
}

function rad(v: number): number {
  return (v * Math.PI) / 180;
}

function deltaQuaternion(pitch = 0, yaw = 0, roll = 0): Quaternion {
  return Quaternion.RotationYawPitchRoll(rad(yaw), rad(pitch), rad(roll));
}

export class ProceduralStanceAnimator {
  private readonly groups = new Map<string, AnimationGroup>();

  constructor(
    private readonly scene: Scene,
    private readonly rig: SkeletonRig
  ) {}

  buildPose(poseId: string): AnimationGroup | null {
    const existing = this.groups.get(poseId);
    if (existing) return existing;

    const pose = martialPoseById(poseId);
    if (!pose) return null;

    const group = new AnimationGroup(`STANCE_${poseId}`, this.scene);
    const targets = this.poseTargets(poseId, pose as any);

    for (const target of targets) {
      this.addBone(group, target);
    }

    if (!group.targetedAnimations.length) {
      group.dispose();
      return null;
    }

    this.groups.set(poseId, group);
    return group;
  }

  private addBone(group: AnimationGroup, target: BoneEuler): void {
    const binding = this.rig.get(target.bone);
    const node = binding?.node;
    if (!binding || !node) return;

    if (!node.rotationQuaternion) {
      node.rotationQuaternion = binding.restRotation.clone();
    }

    const value = binding.restRotation.multiply(
      deltaQuaternion(target.pitch, target.yaw, target.roll)
    );

    const animation = new Animation(
      `${group.name}_${target.bone}`,
      "rotationQuaternion",
      30,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );

    animation.setKeys([
      { frame: 0, value },
      { frame: 30, value: value.clone() },
    ]);
    group.addTargetedAnimation(animation, node);
  }

  private poseTargets(poseId: string, pose: any): BoneEuler[] {
    if (poseId === "karate_zenkutsu_dachi") {
      const rearYaw = pose.geometry?.rear_foot_yaw_deg?.nominal ?? 30;
      return [
        { bone: "hips", pitch: 0, yaw: -8, roll: 0 },
        { bone: "leftThigh", pitch: 28, yaw: 0, roll: -3 },
        { bone: "leftShin", pitch: 45, yaw: 0, roll: 0 },
        { bone: "rightThigh", pitch: -10, yaw: 2, roll: 2 },
        { bone: "rightShin", pitch: 5, yaw: 0, roll: 0 },
        { bone: "rightFoot", yaw: -rearYaw },
        { bone: "leftUpperArm", pitch: -18, yaw: -12, roll: -25 },
        { bone: "rightUpperArm", pitch: -22, yaw: 14, roll: 28 },
        { bone: "leftForearm", pitch: 72 },
        { bone: "rightForearm", pitch: 78 },
      ];
    }

    if (poseId === "karate_sanchin_dachi") {
      const inward = pose.geometry?.front_foot_inward_yaw_deg ?? 20;
      return [
        { bone: "hips", pitch: 0, yaw: 0, roll: 0 },
        { bone: "leftThigh", pitch: 12, yaw: -7, roll: -5 },
        { bone: "rightThigh", pitch: 10, yaw: 7, roll: 5 },
        { bone: "leftShin", pitch: 18 },
        { bone: "rightShin", pitch: 18 },
        { bone: "leftFoot", yaw: inward },
        { bone: "rightFoot", yaw: -inward },
        { bone: "leftUpperArm", pitch: -20, yaw: -10, roll: -18 },
        { bone: "rightUpperArm", pitch: -20, yaw: 10, roll: 18 },
        { bone: "leftForearm", pitch: 88 },
        { bone: "rightForearm", pitch: 88 },
      ];
    }

    if (poseId === "karate_shiko_dachi") {
      const leftYaw = pose.geometry?.left_foot_yaw_deg ?? -45;
      const rightYaw = pose.geometry?.right_foot_yaw_deg ?? 45;
      return [
        { bone: "hips", pitch: 0, yaw: 0, roll: 0 },
        { bone: "leftThigh", pitch: 42, yaw: -18, roll: -28 },
        { bone: "rightThigh", pitch: 42, yaw: 18, roll: 28 },
        { bone: "leftShin", pitch: 62 },
        { bone: "rightShin", pitch: 62 },
        { bone: "leftFoot", yaw: leftYaw },
        { bone: "rightFoot", yaw: rightYaw },
        { bone: "leftUpperArm", pitch: -16, yaw: -12, roll: -18 },
        { bone: "rightUpperArm", pitch: -16, yaw: 12, roll: 18 },
        { bone: "leftForearm", pitch: 76 },
        { bone: "rightForearm", pitch: 76 },
      ];
    }

    if (poseId === "karate_neko_ashi_dachi") {
      return [
        { bone: "hips", pitch: 2, yaw: -5, roll: 2 },
        { bone: "leftThigh", pitch: 48, yaw: -4, roll: -4 },
        { bone: "leftShin", pitch: 70 },
        { bone: "rightThigh", pitch: 26, yaw: 4, roll: 3 },
        { bone: "rightShin", pitch: 42 },
        { bone: "leftUpperArm", pitch: -18, yaw: -12, roll: -22 },
        { bone: "rightUpperArm", pitch: -24, yaw: 12, roll: 24 },
        { bone: "leftForearm", pitch: 78 },
        { bone: "rightForearm", pitch: 82 },
      ];
    }

    return [];
  }

  dispose(): void {
    for (const group of this.groups.values()) group.dispose();
    this.groups.clear();
  }
}
