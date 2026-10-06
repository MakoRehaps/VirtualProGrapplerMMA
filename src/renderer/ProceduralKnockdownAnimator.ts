import { Animation, AnimationGroup, Quaternion, Scene } from "@babylonjs/core";
import { SkeletonRig, type RigBoneId } from "./SkeletonRig";

interface PoseKey {
  t: number;
  pitch?: number;
  yaw?: number;
  roll?: number;
}

function radians(v: number): number {
  return (v * Math.PI) / 180;
}

function delta(pitch = 0, yaw = 0, roll = 0): Quaternion {
  return Quaternion.RotationYawPitchRoll(
    radians(yaw),
    radians(pitch),
    radians(roll)
  );
}

export class ProceduralKnockdownAnimator {
  private knockdown: AnimationGroup | null = null;
  private standup: AnimationGroup | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly rig: SkeletonRig
  ) {}

  buildKnockdown(): AnimationGroup | null {
    if (this.knockdown) return this.knockdown;

    const group = new AnimationGroup("STATE_KNOCKDOWN_SEATED", this.scene);
    this.add(group, "chest", [
      { t: 0, pitch: 0 },
      { t: 0.35, pitch: 18, roll: 8 },
      { t: 0.70, pitch: 38, roll: 14 },
      { t: 1, pitch: 50, roll: 12 },
    ]);
    this.add(group, "hips", [
      { t: 0, pitch: 0 },
      { t: 0.35, pitch: 10 },
      { t: 0.70, pitch: 28 },
      { t: 1, pitch: 36 },
    ]);
    this.add(group, "leftThigh", [
      { t: 0, pitch: 0 },
      { t: 0.45, pitch: 38, roll: -8 },
      { t: 1, pitch: 72, roll: -12 },
    ]);
    this.add(group, "rightThigh", [
      { t: 0, pitch: 0 },
      { t: 0.45, pitch: 34, roll: 8 },
      { t: 1, pitch: 68, roll: 12 },
    ]);
    this.add(group, "leftShin", [
      { t: 0, pitch: 0 },
      { t: 0.50, pitch: 54 },
      { t: 1, pitch: 82 },
    ]);
    this.add(group, "rightShin", [
      { t: 0, pitch: 0 },
      { t: 0.50, pitch: 50 },
      { t: 1, pitch: 78 },
    ]);
    this.add(group, "leftUpperArm", [
      { t: 0, pitch: 0 },
      { t: 0.55, pitch: -28, roll: -24 },
      { t: 1, pitch: -42, roll: -30 },
    ]);
    this.add(group, "rightUpperArm", [
      { t: 0, pitch: 0 },
      { t: 0.55, pitch: -28, roll: 24 },
      { t: 1, pitch: -42, roll: 30 },
    ]);

    if (!group.targetedAnimations.length) {
      group.dispose();
      return null;
    }

    this.knockdown = group;
    return group;
  }

  buildTechnicalStandup(): AnimationGroup | null {
    if (this.standup) return this.standup;

    const group = new AnimationGroup("STATE_TECHNICAL_STANDUP", this.scene);
    this.add(group, "chest", [
      { t: 0, pitch: 50, roll: 12 },
      { t: 0.35, pitch: 30, roll: 8 },
      { t: 0.70, pitch: 12, roll: 3 },
      { t: 1, pitch: 0, roll: 0 },
    ]);
    this.add(group, "hips", [
      { t: 0, pitch: 36 },
      { t: 0.35, pitch: 28 },
      { t: 0.70, pitch: 12 },
      { t: 1, pitch: 0 },
    ]);
    this.add(group, "leftThigh", [
      { t: 0, pitch: 72, roll: -12 },
      { t: 0.40, pitch: 52, roll: -8 },
      { t: 0.72, pitch: 24, roll: -3 },
      { t: 1, pitch: 0, roll: 0 },
    ]);
    this.add(group, "rightThigh", [
      { t: 0, pitch: 68, roll: 12 },
      { t: 0.40, pitch: 48, roll: 8 },
      { t: 0.72, pitch: 22, roll: 3 },
      { t: 1, pitch: 0, roll: 0 },
    ]);
    this.add(group, "leftShin", [
      { t: 0, pitch: 82 },
      { t: 0.42, pitch: 58 },
      { t: 0.74, pitch: 26 },
      { t: 1, pitch: 0 },
    ]);
    this.add(group, "rightShin", [
      { t: 0, pitch: 78 },
      { t: 0.42, pitch: 54 },
      { t: 0.74, pitch: 24 },
      { t: 1, pitch: 0 },
    ]);

    if (!group.targetedAnimations.length) {
      group.dispose();
      return null;
    }

    this.standup = group;
    return group;
  }

  private add(
    group: AnimationGroup,
    id: RigBoneId,
    keys: PoseKey[]
  ): void {
    const binding = this.rig.get(id);
    const node = binding?.node;
    if (!binding || !node) return;

    if (!node.rotationQuaternion) {
      node.rotationQuaternion = binding.restRotation.clone();
    }

    const animation = new Animation(
      `${group.name}_${id}`,
      "rotationQuaternion",
      60,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    animation.setKeys(
      keys.map((k) => ({
        frame: Math.round(k.t * 42),
        value: binding.restRotation.multiply(
          delta(k.pitch, k.yaw, k.roll)
        ),
      }))
    );

    group.addTargetedAnimation(animation, node);
  }

  dispose(): void {
    this.knockdown?.dispose();
    this.standup?.dispose();
    this.knockdown = null;
    this.standup = null;
  }
}
