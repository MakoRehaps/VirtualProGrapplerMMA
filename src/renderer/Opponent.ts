import { TransformNode, Vector3 } from "@babylonjs/core";
import { AnimationController } from "./AnimationController";
import { Anim, Tuning } from "../game/config";

/**
 * The other wrestler in the ring.
 *
 * Deliberately inert for now: no AI, no movement. It exists so the player has
 * something to orient against, and so the facing and default-run rules have a
 * real target. When the HFSM lands this is what the InteractionRegion will
 * track distance and facing angle against.
 */
export class Opponent {
  private externalPoseLock = false;

  constructor(
    readonly root: TransformNode,
    private animations: AnimationController
  ) {
    this.animations.play(Anim.IDLE, { loop: true });
  }

  get position(): Vector3 {
    return this.root.position;
  }

  registerAnimations(groups: import("@babylonjs/core").AnimationGroup[]): void {
    this.animations.registerMany(groups);
  }

  playReaction(name: string, onEnd?: () => void): void {
    if (!this.animations.has(name)) return;
    this.animations.play(name, {
      loop: false,
      restart: true,
      onEnd,
    });
  }

  setExternalPoseLock(locked: boolean): void {
    this.externalPoseLock = locked;
    if (locked) {
      this.animations.stopAll();
    } else {
      this.animations.play(Anim.IDLE, { loop: true, restart: true });
    }
  }

  /** Turns toward the player, optionally pressures into fighting range. */
  update(
    deltaSeconds: number,
    facePoint: Vector3 | null,
    desiredDistance: number | null = null,
    movementScale = 1
  ): void {
    if (this.externalPoseLock) return;
    if (facePoint) {
      const dx = facePoint.x - this.root.position.x;
      const dz = facePoint.z - this.root.position.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > 1e-6) {
        const target = Math.atan2(dx, dz);
        this.root.rotation.y = approachAngle(
          this.root.rotation.y,
          target,
          Tuning.turnSpeed * deltaSeconds
        );

        if (desiredDistance !== null) {
          const distance = Math.sqrt(distanceSq);
          if (distance > desiredDistance + 0.05) {
            const travel = Math.min(
              distance - desiredDistance,
              1.7 * Math.max(0.45, Math.min(1, movementScale)) * deltaSeconds
            );
            this.root.position.x += (dx / distance) * travel;
            this.root.position.z += (dz / distance) * travel;
          }
        }
      }
    }
    this.animations.update(deltaSeconds);
  }

  dispose(): void {
    this.animations.dispose();
    this.root.dispose();
  }
}

/** Moves `from` toward `to` by at most `maxDelta`, wrapping at +/-PI. */
function approachAngle(from: number, to: number, maxDelta: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxDelta) return to;
  return from + Math.sign(diff) * maxDelta;
}
