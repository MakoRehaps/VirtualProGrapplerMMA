import {
  Animation,
  AnimationGroup,
  Quaternion,
  Scene,
  TransformNode,
} from "@babylonjs/core";
import { SkeletonRig, type RigBoneId } from "./SkeletonRig";

export type ClinchPoseId =
  | "single_collar_tie"
  | "thai_plum"
  | "over_under"
  | "double_underhooks"
  | "front_headlock";

interface BonePose {
  id: RigBoneId;
  pitch?: number;
  yaw?: number;
  roll?: number;
}

function rad(v: number): number {
  return (v * Math.PI) / 180;
}

function delta(pitch = 0, yaw = 0, roll = 0): Quaternion {
  return Quaternion.RotationYawPitchRoll(rad(yaw), rad(pitch), rad(roll));
}

export class ProceduralClinchAnimator {
  private readonly groups = new Map<ClinchPoseId, AnimationGroup>();

  constructor(
    private readonly scene: Scene,
    private readonly attackerRoot: TransformNode,
    private readonly attackerRig: SkeletonRig,
    private readonly defenderRoot: TransformNode,
    private readonly defenderRig: SkeletonRig
  ) {}

  build(pose: ClinchPoseId): AnimationGroup | null {
    const existing = this.groups.get(pose);
    if (existing) return existing;

    const group = new AnimationGroup(`CLINCH_${pose}`, this.scene);
    const [a, d] = this.pose(pose);

    for (const p of a) this.add(group, this.attackerRig, `a_${p.id}`, p);
    for (const p of d) this.add(group, this.defenderRig, `d_${p.id}`, p);

    if (!group.targetedAnimations.length) {
      group.dispose();
      return null;
    }

    this.groups.set(pose, group);
    return group;
  }

  alignRoots(distance = 0.64): void {
    const yaw = this.attackerRoot.rotation.y;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);

    this.defenderRoot.position.x =
      this.attackerRoot.position.x + forwardX * distance;
    this.defenderRoot.position.z =
      this.attackerRoot.position.z + forwardZ * distance;

    this.attackerRoot.rotation.y = yaw;
    this.defenderRoot.rotation.y = yaw + Math.PI;
  }

  private add(
    group: AnimationGroup,
    rig: SkeletonRig,
    name: string,
    pose: BonePose
  ): void {
    const binding = rig.get(pose.id);
    const node = binding?.node;
    if (!binding || !node) return;

    if (!node.rotationQuaternion) {
      node.rotationQuaternion = binding.restRotation.clone();
    }

    const value = binding.restRotation.multiply(
      delta(pose.pitch, pose.yaw, pose.roll)
    );

    const animation = new Animation(
      `${group.name}_${name}`,
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

  private pose(pose: ClinchPoseId): [BonePose[], BonePose[]] {
    if (pose === "thai_plum") {
      return [
        [
          { id: "chest", pitch: 8 },
          { id: "leftUpperArm", pitch: -52, yaw: -12, roll: -24 },
          { id: "rightUpperArm", pitch: -52, yaw: 12, roll: 24 },
          { id: "leftForearm", pitch: 110, yaw: -8 },
          { id: "rightForearm", pitch: 110, yaw: 8 },
        ],
        [
          { id: "head", pitch: 12 },
          { id: "chest", pitch: 18 },
          { id: "leftUpperArm", pitch: -20, roll: -10 },
          { id: "rightUpperArm", pitch: -20, roll: 10 },
          { id: "leftForearm", pitch: 74 },
          { id: "rightForearm", pitch: 74 },
        ],
      ];
    }

    if (pose === "single_collar_tie") {
      return [
        [
          { id: "leftUpperArm", pitch: -42, yaw: -18, roll: -22 },
          { id: "leftForearm", pitch: 104, yaw: -8 },
          { id: "rightUpperArm", pitch: -18, yaw: 12, roll: 18 },
          { id: "rightForearm", pitch: 82 },
          { id: "chest", yaw: -8 },
        ],
        [
          { id: "rightUpperArm", pitch: -34, yaw: 18, roll: 22 },
          { id: "rightForearm", pitch: 96 },
          { id: "leftUpperArm", pitch: -18, roll: -14 },
          { id: "leftForearm", pitch: 76 },
          { id: "chest", yaw: 8 },
        ],
      ];
    }

    if (pose === "double_underhooks") {
      return [
        [
          { id: "leftUpperArm", pitch: -26, yaw: -22, roll: -42 },
          { id: "rightUpperArm", pitch: -26, yaw: 22, roll: 42 },
          { id: "leftForearm", pitch: 92 },
          { id: "rightForearm", pitch: 92 },
          { id: "chest", pitch: 10 },
        ],
        [
          { id: "leftUpperArm", pitch: -36, yaw: 12, roll: -16 },
          { id: "rightUpperArm", pitch: -36, yaw: -12, roll: 16 },
          { id: "leftForearm", pitch: 78 },
          { id: "rightForearm", pitch: 78 },
          { id: "chest", pitch: 14 },
        ],
      ];
    }

    if (pose === "front_headlock") {
      return [
        [
          { id: "chest", pitch: 18, yaw: -8 },
          { id: "rightUpperArm", pitch: -44, yaw: 18, roll: 30 },
          { id: "rightForearm", pitch: 118, yaw: 12 },
          { id: "leftUpperArm", pitch: -24, roll: -18 },
          { id: "leftForearm", pitch: 86 },
        ],
        [
          { id: "head", pitch: 28, roll: 8 },
          { id: "chest", pitch: 34 },
          { id: "leftUpperArm", pitch: -16, roll: -12 },
          { id: "rightUpperArm", pitch: -16, roll: 12 },
        ],
      ];
    }

    return [
      [
        { id: "chest", pitch: 8 },
        { id: "leftUpperArm", pitch: -30, yaw: -18, roll: -28 },
        { id: "rightUpperArm", pitch: -30, yaw: 18, roll: 28 },
        { id: "leftForearm", pitch: 92 },
        { id: "rightForearm", pitch: 92 },
      ],
      [
        { id: "chest", pitch: 8 },
        { id: "leftUpperArm", pitch: -30, yaw: 18, roll: -28 },
        { id: "rightUpperArm", pitch: -30, yaw: -18, roll: 28 },
        { id: "leftForearm", pitch: 92 },
        { id: "rightForearm", pitch: 92 },
      ],
    ];
  }

  dispose(): void {
    for (const group of this.groups.values()) group.dispose();
    this.groups.clear();
  }
}
