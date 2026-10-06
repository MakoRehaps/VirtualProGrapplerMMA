import { Quaternion } from "@babylonjs/core";
import { SkeletonRig } from "./SkeletonRig";

function rad(v: number): number {
  return (v * Math.PI) / 180;
}

function poseDelta(horizontal: number, vertical: number): Quaternion {
  const h = Math.max(-1, Math.min(1, horizontal));
  const v = Math.max(-1, Math.min(1, vertical));

  // Horizontal = slip/roll away from the center line.
  // Negative vertical = duck, positive vertical = lean back.
  const pitch = v < 0 ? -18 * -v : 12 * v;
  const yaw = 16 * h;
  const roll = -12 * h;

  return Quaternion.RotationYawPitchRoll(rad(yaw), rad(pitch), rad(roll));
}

export class DefensivePoseOverlay {
  private lastHeadDelta = Quaternion.Identity();
  private lastChestDelta = Quaternion.Identity();

  constructor(private readonly rig: SkeletonRig) {}

  apply(horizontal: number, vertical: number): void {
    const head = this.rig.get("head")?.node ?? null;
    const chest = this.rig.get("chest")?.node ?? null;

    const headDelta = poseDelta(horizontal, vertical);
    const chestDelta = poseDelta(horizontal * 0.55, vertical * 0.45);

    if (head?.rotationQuaternion) {
      head.rotationQuaternion = head.rotationQuaternion
        .multiply(this.lastHeadDelta.conjugate())
        .multiply(headDelta);
    }

    if (chest?.rotationQuaternion) {
      chest.rotationQuaternion = chest.rotationQuaternion
        .multiply(this.lastChestDelta.conjugate())
        .multiply(chestDelta);
    }

    this.lastHeadDelta = headDelta;
    this.lastChestDelta = chestDelta;
  }

  reset(): void {
    this.apply(0, 0);
  }
}
