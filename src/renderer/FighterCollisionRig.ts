import { Vector3 } from "@babylonjs/core";
import type { RegionalCondition } from "@/combat/mayQuvTypes";
import { SkeletonRig, type RigBoneId } from "./SkeletonRig";

export type BodyRegion = keyof RegionalCondition;

export interface SphereVolume {
  center: Vector3;
  radius: number;
}

export interface CapsuleVolume {
  a: Vector3;
  b: Vector3;
  radius: number;
}

export interface HurtVolume {
  region: BodyRegion;
  shape: SphereVolume | CapsuleVolume;
  kind: "sphere" | "capsule";
}

export interface StrikeVolume {
  sourceBone: RigBoneId;
  center: Vector3;
  radius: number;
}

function worldPosition(rig: SkeletonRig, id: RigBoneId): Vector3 | null {
  const binding = rig.get(id);
  const node = binding?.node;
  if (node) {
    node.computeWorldMatrix(true);
    return node.getAbsolutePosition().clone();
  }
  if (!binding) return null;

  return Vector3.TransformCoordinates(
    Vector3.Zero(),
    binding.bone.getAbsoluteTransform()
  );
}

function midpoint(a: Vector3, b: Vector3): Vector3 {
  return a.add(b).scale(0.5);
}

function capsule(
  region: BodyRegion,
  a: Vector3 | null,
  b: Vector3 | null,
  radius: number
): HurtVolume | null {
  if (!a || !b) return null;
  return { region, kind: "capsule", shape: { a, b, radius } };
}

function sphere(
  region: BodyRegion,
  center: Vector3 | null,
  radius: number
): HurtVolume | null {
  if (!center) return null;
  return { region, kind: "sphere", shape: { center, radius } };
}

export class FighterCollisionRig {
  constructor(
    readonly rig: SkeletonRig,
    readonly bodyHeightM: number
  ) {}

  hurtVolumes(): HurtVolume[] {
    const scale = this.bodyHeightM / 1.78;

    const head = worldPosition(this.rig, "head");
    const neck = worldPosition(this.rig, "neck");
    const chest = worldPosition(this.rig, "chest");
    const hips = worldPosition(this.rig, "hips");

    const lUpper = worldPosition(this.rig, "leftUpperArm");
    const lFore = worldPosition(this.rig, "leftForearm");
    const rUpper = worldPosition(this.rig, "rightUpperArm");
    const rFore = worldPosition(this.rig, "rightForearm");

    const lThigh = worldPosition(this.rig, "leftThigh");
    const lShin = worldPosition(this.rig, "leftShin");
    const lFoot = worldPosition(this.rig, "leftFoot");
    const rThigh = worldPosition(this.rig, "rightThigh");
    const rShin = worldPosition(this.rig, "rightShin");
    const rFoot = worldPosition(this.rig, "rightFoot");

    const out: Array<HurtVolume | null> = [
      sphere("head", head, 0.16 * scale),
      capsule("body", neck ?? chest, hips, 0.22 * scale),
      capsule("leftArm", lUpper, lFore, 0.10 * scale),
      capsule("rightArm", rUpper, rFore, 0.10 * scale),
      capsule("leftLeg", lThigh, lShin, 0.13 * scale),
      capsule("leftLeg", lShin, lFoot, 0.105 * scale),
      capsule("rightLeg", rThigh, rShin, 0.13 * scale),
      capsule("rightLeg", rShin, rFoot, 0.105 * scale),
    ];

    return out.filter((x): x is HurtVolume => Boolean(x));
  }

  strikeVolume(sourceBone: RigBoneId, radiusM: number): StrikeVolume | null {
    const center = worldPosition(this.rig, sourceBone);
    if (!center) return null;
    return {
      sourceBone,
      center,
      radius: radiusM * (this.bodyHeightM / 1.78),
    };
  }

  handStrike(side: "left" | "right"): StrikeVolume | null {
    return this.strikeVolume(side === "left" ? "leftHand" : "rightHand", 0.10);
  }

  footStrike(side: "left" | "right"): StrikeVolume | null {
    return this.strikeVolume(side === "left" ? "leftFoot" : "rightFoot", 0.12);
  }

  kneeStrike(side: "left" | "right"): StrikeVolume | null {
    const thigh = worldPosition(this.rig, side === "left" ? "leftThigh" : "rightThigh");
    const shin = worldPosition(this.rig, side === "left" ? "leftShin" : "rightShin");
    if (!thigh || !shin) return null;
    return {
      sourceBone: side === "left" ? "leftShin" : "rightShin",
      center: midpoint(thigh, shin),
      radius: 0.13 * (this.bodyHeightM / 1.78),
    };
  }
}

function closestPointOnSegment(p: Vector3, a: Vector3, b: Vector3): Vector3 {
  const ab = b.subtract(a);
  const denom = Vector3.Dot(ab, ab);
  if (denom <= 1e-8) return a.clone();
  const t = Math.max(0, Math.min(1, Vector3.Dot(p.subtract(a), ab) / denom));
  return a.add(ab.scale(t));
}

export function strikeIntersectsHurt(
  strike: StrikeVolume,
  hurt: HurtVolume
): boolean {
  if (hurt.kind === "sphere") {
    const s = hurt.shape as SphereVolume;
    return Vector3.DistanceSquared(strike.center, s.center) <=
      (strike.radius + s.radius) * (strike.radius + s.radius);
  }

  const c = hurt.shape as CapsuleVolume;
  const nearest = closestPointOnSegment(strike.center, c.a, c.b);
  return Vector3.DistanceSquared(strike.center, nearest) <=
    (strike.radius + c.radius) * (strike.radius + c.radius);
}

export function firstHitRegion(
  strike: StrikeVolume,
  hurts: HurtVolume[]
): BodyRegion | null {
  let best: { region: BodyRegion; d2: number } | null = null;

  for (const hurt of hurts) {
    if (!strikeIntersectsHurt(strike, hurt)) continue;

    let p: Vector3;
    if (hurt.kind === "sphere") {
      p = (hurt.shape as SphereVolume).center;
    } else {
      const c = hurt.shape as CapsuleVolume;
      p = closestPointOnSegment(strike.center, c.a, c.b);
    }

    const d2 = Vector3.DistanceSquared(strike.center, p);
    if (!best || d2 < best.d2) best = { region: hurt.region, d2 };
  }

  return best?.region ?? null;
}
