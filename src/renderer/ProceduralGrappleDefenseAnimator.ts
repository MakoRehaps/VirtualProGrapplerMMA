import {
  Animation,
  AnimationGroup,
  Quaternion,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { SkeletonRig, type RigBoneId } from "./SkeletonRig";

type DefenseId = "sprawl" | "whizzer";

interface BoneKey {
  t: number;
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

export class ProceduralGrappleDefenseAnimator {
  private readonly groups = new Map<DefenseId, AnimationGroup>();

  constructor(
    private readonly scene: Scene,
    private readonly attackerRoot: TransformNode,
    private readonly attackerRig: SkeletonRig,
    private readonly defenderRoot: TransformNode,
    private readonly defenderRig: SkeletonRig
  ) {}

  build(id: DefenseId): AnimationGroup | null {
    const cached = this.groups.get(id);
    if (cached) return cached;

    const group = new AnimationGroup(`DEFENSE_${id}`, this.scene);
    if (id === "sprawl") this.buildSprawl(group);
    else this.buildWhizzer(group);

    if (!group.targetedAnimations.length) {
      group.dispose();
      return null;
    }

    this.groups.set(id, group);
    return group;
  }

  private addBone(
    group: AnimationGroup,
    rig: SkeletonRig,
    id: RigBoneId,
    keys: BoneKey[],
    frames = 42
  ): void {
    const binding = rig.get(id);
    const node = binding?.node;
    if (!binding || !node) return;

    if (!node.rotationQuaternion) {
      node.rotationQuaternion = binding.restRotation.clone();
    }

    const anim = new Animation(
      `${group.name}_${id}_${node.name}`,
      "rotationQuaternion",
      60,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    anim.setKeys(
      keys.map((k) => ({
        frame: Math.round(k.t * frames),
        value: binding.restRotation.multiply(
          delta(k.pitch, k.yaw, k.roll)
        ),
      }))
    );

    group.addTargetedAnimation(anim, node);
  }

  private addRootPosition(
    group: AnimationGroup,
    root: TransformNode,
    values: Array<{ t: number; offset: [number, number, number] }>,
    frames = 42
  ): void {
    const base = root.position.clone();
    const anim = new Animation(
      `${group.name}_${root.name}_position`,
      "position",
      60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    anim.setKeys(
      values.map((k) => ({
        frame: Math.round(k.t * frames),
        value: base.add(new Vector3(...k.offset)),
      }))
    );
    group.addTargetedAnimation(anim, root);
  }

  private buildSprawl(group: AnimationGroup): void {
    const frames = 46;

    this.addBone(group, this.defenderRig, "hips", [
      { t: 0, pitch: 0 },
      { t: 0.26, pitch: 12 },
      { t: 0.54, pitch: 28 },
      { t: 0.78, pitch: 20 },
      { t: 1, pitch: 6 },
    ], frames);
    this.addBone(group, this.defenderRig, "chest", [
      { t: 0, pitch: 0 },
      { t: 0.28, pitch: 22 },
      { t: 0.56, pitch: 38 },
      { t: 0.80, pitch: 26 },
      { t: 1, pitch: 8 },
    ], frames);
    this.addBone(group, this.defenderRig, "leftThigh", [
      { t: 0, pitch: 0 },
      { t: 0.32, pitch: 18 },
      { t: 0.58, pitch: 36 },
      { t: 0.82, pitch: 22 },
      { t: 1, pitch: 4 },
    ], frames);
    this.addBone(group, this.defenderRig, "rightThigh", [
      { t: 0, pitch: 0 },
      { t: 0.32, pitch: 18 },
      { t: 0.58, pitch: 36 },
      { t: 0.82, pitch: 22 },
      { t: 1, pitch: 4 },
    ], frames);

    this.addBone(group, this.attackerRig, "chest", [
      { t: 0, pitch: 18 },
      { t: 0.30, pitch: 34 },
      { t: 0.56, pitch: 52 },
      { t: 0.82, pitch: 40 },
      { t: 1, pitch: 18 },
    ], frames);
    this.addRootPosition(group, this.attackerRoot, [
      { t: 0, offset: [0, 0, 0] },
      { t: 0.36, offset: [0, -0.03, 0.08] },
      { t: 0.62, offset: [0, -0.10, 0.16] },
      { t: 1, offset: [0, 0, -0.06] },
    ], frames);
  }

  private buildWhizzer(group: AnimationGroup): void {
    const frames = 40;

    this.addBone(group, this.defenderRig, "chest", [
      { t: 0, yaw: 0 },
      { t: 0.26, yaw: 18, roll: 5 },
      { t: 0.58, yaw: 42, roll: 12 },
      { t: 0.82, yaw: 30, roll: 8 },
      { t: 1, yaw: 10, roll: 2 },
    ], frames);
    this.addBone(group, this.defenderRig, "rightUpperArm", [
      { t: 0, pitch: -30, roll: 28 },
      { t: 0.30, pitch: -46, yaw: 16, roll: 52 },
      { t: 0.62, pitch: -64, yaw: 24, roll: 68 },
      { t: 1, pitch: -32, roll: 28 },
    ], frames);
    this.addBone(group, this.defenderRig, "rightForearm", [
      { t: 0, pitch: 90 },
      { t: 0.30, pitch: 104 },
      { t: 0.62, pitch: 118 },
      { t: 1, pitch: 90 },
    ], frames);

    this.addBone(group, this.attackerRig, "chest", [
      { t: 0, yaw: 0 },
      { t: 0.28, yaw: -10 },
      { t: 0.60, yaw: -28, roll: -8 },
      { t: 0.84, yaw: -18, roll: -4 },
      { t: 1, yaw: -6 },
    ], frames);
  }

  dispose(): void {
    for (const group of this.groups.values()) group.dispose();
    this.groups.clear();
  }
}
