import { Animation, AnimationGroup, Quaternion, Scene } from "@babylonjs/core";
import type { RegionalCondition } from "@/combat/mayQuvTypes";
import { SkeletonRig, type RigBoneId } from "./SkeletonRig";

type Region = keyof RegionalCondition;

interface Key {
  t: number;
  pitch?: number;
  yaw?: number;
  roll?: number;
}

function r(v: number): number {
  return (v * Math.PI) / 180;
}

function dq(pitch = 0, yaw = 0, roll = 0): Quaternion {
  return Quaternion.RotationYawPitchRoll(r(yaw), r(pitch), r(roll));
}

export class ProceduralHitReactionAnimator {
  private readonly groups = new Map<Region, AnimationGroup>();

  constructor(
    private readonly scene: Scene,
    private readonly rig: SkeletonRig
  ) {}

  build(region: Region): AnimationGroup | null {
    const existing = this.groups.get(region);
    if (existing) return existing;

    const group = new AnimationGroup(`REACT_${region}`, this.scene);
    const pattern = this.pattern(region);
    for (const [bone, keys] of pattern) this.add(group, bone, keys);

    if (!group.targetedAnimations.length) {
      group.dispose();
      return null;
    }

    this.groups.set(region, group);
    return group;
  }

  buildAll(): AnimationGroup[] {
    return (["head","body","leftArm","rightArm","leftLeg","rightLeg"] as Region[])
      .map((x) => this.build(x))
      .filter((x): x is AnimationGroup => Boolean(x));
  }

  private add(group: AnimationGroup, id: RigBoneId, keys: Key[]): void {
    const binding = this.rig.get(id);
    const node = binding?.node;
    if (!binding || !node) return;

    if (!node.rotationQuaternion) node.rotationQuaternion = binding.restRotation.clone();

    const anim = new Animation(
      `${group.name}_${id}`,
      "rotationQuaternion",
      60,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    anim.setKeys(keys.map((k) => ({
      frame: Math.round(k.t * 24),
      value: binding.restRotation.multiply(dq(k.pitch, k.yaw, k.roll)),
    })));
    group.addTargetedAnimation(anim, node);
  }

  private pattern(region: Region): Array<[RigBoneId, Key[]]> {
    const neutral: Key = { t: 0, pitch: 0, yaw: 0, roll: 0 };
    const end: Key = { t: 1, pitch: 0, yaw: 0, roll: 0 };

    switch (region) {
      case "head":
        return [
          ["head", [neutral, { t: 0.35, pitch: -18, yaw: 18, roll: 8 }, { t: 0.62, pitch: 8, yaw: -10, roll: -4 }, end]],
          ["chest", [neutral, { t: 0.35, pitch: -8, yaw: 12, roll: 5 }, end]],
        ];
      case "body":
        return [
          ["chest", [neutral, { t: 0.35, pitch: 24, yaw: -6, roll: 4 }, { t: 0.68, pitch: 10 }, end]],
          ["hips", [neutral, { t: 0.35, pitch: 8, yaw: 4, roll: -3 }, end]],
        ];
      case "leftArm":
        return [
          ["leftUpperArm", [neutral, { t: 0.30, pitch: 18, yaw: -18, roll: -28 }, { t: 0.62, pitch: -6, roll: 8 }, end]],
          ["chest", [neutral, { t: 0.30, yaw: 8, roll: 4 }, end]],
        ];
      case "rightArm":
        return [
          ["rightUpperArm", [neutral, { t: 0.30, pitch: 18, yaw: 18, roll: 28 }, { t: 0.62, pitch: -6, roll: -8 }, end]],
          ["chest", [neutral, { t: 0.30, yaw: -8, roll: -4 }, end]],
        ];
      case "leftLeg":
        return [
          ["leftThigh", [neutral, { t: 0.30, pitch: 22, yaw: -6, roll: -18 }, { t: 0.62, pitch: 8, roll: 6 }, end]],
          ["hips", [neutral, { t: 0.30, yaw: 5, roll: 8 }, end]],
        ];
      case "rightLeg":
        return [
          ["rightThigh", [neutral, { t: 0.30, pitch: 22, yaw: 6, roll: 18 }, { t: 0.62, pitch: 8, roll: -6 }, end]],
          ["hips", [neutral, { t: 0.30, yaw: -5, roll: -8 }, end]],
        ];
    }
  }

  dispose(): void {
    for (const group of this.groups.values()) group.dispose();
    this.groups.clear();
  }
}
