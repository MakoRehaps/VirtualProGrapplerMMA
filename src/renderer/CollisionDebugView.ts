import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import {
  type FighterCollisionRig,
  type HurtVolume,
  type StrikeVolume,
} from "./FighterCollisionRig";

function centerOf(hurt: HurtVolume): Vector3 {
  if (hurt.kind === "sphere") {
    const shape = hurt.shape as import("./FighterCollisionRig").SphereVolume;
    return shape.center.clone();
  }
  const shape = hurt.shape as import("./FighterCollisionRig").CapsuleVolume;
  return shape.a.add(shape.b).scale(0.5);
}

export class CollisionDebugView {
  private enabled = false;
  private readonly markers: Mesh[] = [];
  private readonly materials = new Map<string, StandardMaterial>();

  constructor(private readonly scene: Scene) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  update(
    player: FighterCollisionRig | null,
    opponent: FighterCollisionRig | null,
    strike: StrikeVolume | null = null
  ): void {
    if (!this.enabled) return;
    this.clear();

    if (player) this.drawRig(player, "player");
    if (opponent) this.drawRig(opponent, "opponent");
    if (strike) {
      const m = MeshBuilder.CreateSphere(
        "debug_strike",
        { diameter: strike.radius * 2 },
        this.scene
      );
      m.position.copyFrom(strike.center);
      m.material = this.material("strike", new Color3(1, 1, 0));
      m.isPickable = false;
      this.markers.push(m);
    }
  }

  private drawRig(rig: FighterCollisionRig, prefix: string): void {
    for (const hurt of rig.hurtVolumes()) {
      const radius = hurt.shape.radius;

      const m = MeshBuilder.CreateSphere(
        `${prefix}_hurt_${hurt.region}`,
        { diameter: radius * 2 },
        this.scene
      );
      m.position.copyFrom(centerOf(hurt));
      m.material = this.material(
        hurt.region,
        this.regionColor(hurt.region)
      );
      m.isPickable = false;
      this.markers.push(m);
    }
  }

  private regionColor(region: string): Color3 {
    switch (region) {
      case "head":
        return new Color3(1, 0.2, 0.2);
      case "body":
        return new Color3(1, 0.55, 0.15);
      case "leftArm":
      case "rightArm":
        return new Color3(0.2, 0.7, 1);
      case "leftLeg":
      case "rightLeg":
        return new Color3(0.35, 1, 0.35);
      default:
        return Color3.White();
    }
  }

  private material(key: string, color: Color3): StandardMaterial {
    const existing = this.materials.get(key);
    if (existing) return existing;

    const material = new StandardMaterial(`debug_${key}_mat`, this.scene);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.45);
    material.alpha = 0.34;
    material.wireframe = true;
    material.disableLighting = true;
    this.materials.set(key, material);
    return material;
  }

  private clear(): void {
    for (const marker of this.markers) marker.dispose();
    this.markers.length = 0;
  }

  dispose(): void {
    this.clear();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
  }
}
