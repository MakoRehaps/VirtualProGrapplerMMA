import { Bone, Quaternion, Skeleton, TransformNode, Vector3 } from "@babylonjs/core";

export type RigBoneId =
  | "root"
  | "hips"
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "leftShoulder"
  | "leftUpperArm"
  | "leftForearm"
  | "leftHand"
  | "rightShoulder"
  | "rightUpperArm"
  | "rightForearm"
  | "rightHand"
  | "leftThigh"
  | "leftShin"
  | "leftFoot"
  | "rightThigh"
  | "rightShin"
  | "rightFoot";

const ALIASES: Record<RigBoneId, string[]> = {
  root: ["root", "armature"],
  hips: ["hips", "pelvis", "hip"],
  spine: ["spine", "spine1", "spine01", "lowerback"],
  chest: ["chest", "spine2", "spine02", "upperchest", "upperback"],
  neck: ["neck"],
  head: ["head"],
  leftShoulder: ["leftshoulder", "shoulderl", "lshoulder", "claviclel", "leftclavicle"],
  leftUpperArm: ["leftupperarm", "upperarml", "lupperarm", "arml", "leftarm"],
  leftForearm: ["leftforearm", "forearml", "lforearm", "lowerarml"],
  leftHand: ["lefthand", "handl", "lhand"],
  rightShoulder: ["rightshoulder", "shoulderr", "rshoulder", "clavicler", "rightclavicle"],
  rightUpperArm: ["rightupperarm", "upperarmr", "rupperarm", "armr", "rightarm"],
  rightForearm: ["rightforearm", "forearmr", "rforearm", "lowerarmr"],
  rightHand: ["righthand", "handr", "rhand"],
  leftThigh: ["leftupleg", "leftthigh", "thighl", "lupleg", "upperlegl"],
  leftShin: ["leftleg", "leftshin", "shinl", "lleg", "lowerlegl", "calfl"],
  leftFoot: ["leftfoot", "footl", "lfoot"],
  rightThigh: ["rightupleg", "rightthigh", "thighr", "rupleg", "upperlegr"],
  rightShin: ["rightleg", "rightshin", "shinr", "rleg", "lowerlegr", "calfr"],
  rightFoot: ["rightfoot", "footr", "rfoot"],
};

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface RigBoneBinding {
  id: RigBoneId;
  bone: Bone;
  node: TransformNode | null;
  restRotation: Quaternion;
  restPosition: Vector3;
}

export class SkeletonRig {
  private readonly bindings = new Map<RigBoneId, RigBoneBinding>();
  readonly skeletons: Skeleton[];

  constructor(skeletons: Skeleton[]) {
    this.skeletons = skeletons;
    const bones = skeletons.flatMap((s) => s.bones);

    for (const id of Object.keys(ALIASES) as RigBoneId[]) {
      const bone = this.findBone(bones, ALIASES[id]);
      if (!bone) continue;

      const node = bone.getTransformNode() ?? null;
      const restRotation =
        node?.rotationQuaternion?.clone() ??
        Quaternion.FromEulerVector(node?.rotation ?? Vector3.Zero());
      const restPosition = node?.position?.clone() ?? Vector3.Zero();

      this.bindings.set(id, {
        id,
        bone,
        node,
        restRotation,
        restPosition,
      });
    }
  }

  private findBone(bones: Bone[], aliases: string[]): Bone | null {
    const normalizedAliases = aliases.map(normalize);

    for (const bone of bones) {
      const n = normalize(bone.name);
      if (normalizedAliases.includes(n)) return bone;
    }

    for (const bone of bones) {
      const n = normalize(bone.name);
      if (normalizedAliases.some((alias) => n.endsWith(alias) || n.includes(alias))) {
        return bone;
      }
    }

    return null;
  }

  get(id: RigBoneId): RigBoneBinding | null {
    return this.bindings.get(id) ?? null;
  }

  has(id: RigBoneId): boolean {
    return this.bindings.has(id);
  }

  get resolvedBoneIds(): RigBoneId[] {
    return [...this.bindings.keys()];
  }

  get unresolvedBoneIds(): RigBoneId[] {
    return (Object.keys(ALIASES) as RigBoneId[]).filter((id) => !this.bindings.has(id));
  }

  get sourceBoneNames(): string[] {
    return this.skeletons.flatMap((s) => s.bones.map((b) => b.name));
  }

  resetPose(): void {
    for (const binding of this.bindings.values()) {
      const node = binding.node;
      if (!node) continue;
      node.rotationQuaternion = binding.restRotation.clone();
      node.position.copyFrom(binding.restPosition);
    }
  }
}
