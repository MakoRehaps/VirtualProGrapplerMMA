import {
  Animation,
  AnimationGroup,
  Quaternion,
  Scene,
} from "@babylonjs/core";
import { motionProfilesForTechnique } from "@/data/combatCatalog";
import { SkeletonRig, type RigBoneId } from "./SkeletonRig";

interface EulerKey {
  t: number;
  pitch: number;
  yaw: number;
  roll: number;
}

function deg(v: number): number {
  return (v * Math.PI) / 180;
}

function qFromDegrees(pitch: number, yaw: number, roll: number): Quaternion {
  return Quaternion.RotationYawPitchRoll(deg(yaw), deg(pitch), deg(roll));
}

function multiplyRest(rest: Quaternion, delta: Quaternion): Quaternion {
  return rest.multiply(delta);
}

export class ProceduralMartialAnimator {
  private readonly created = new Map<string, AnimationGroup>();

  constructor(
    private readonly scene: Scene,
    private readonly rig: SkeletonRig
  ) {}

  get clipNames(): string[] {
    return [...this.created.keys()];
  }

  buildTechnique(
    techniqueId: string,
    preferredFamily?: string
  ): AnimationGroup | null {
    const profiles = motionProfilesForTechnique(techniqueId);
    const supportsSynthesized = [
      "lead_hook",
      "rear_hook",
      "lead_uppercut",
      "rear_uppercut",
      "overhand",
      "body_jab",
      "body_cross",
      "palm_strike",
      "backfist",
      "spinning_backfist",
      "front_kick",
      "teep",
      "calf_kick",
      "spinning_back_kick",
      "axe_kick",
      "hook_kick",
      "crescent_kick",
      "question_mark_kick",
      "leg_kick_grounded",
      "lead_knee",
      "rear_knee",
      "knee_head",
      "lead_elbow",
      "rear_elbow",
      "spinning_elbow",
      "soccer_kick_head",
      "stomp_head",
      "stomp_body",
      "grounded_knee_head",
    ].includes(techniqueId);
    if (!profiles.length && !supportsSynthesized) return null;

    const profile =
      profiles.find((p) => p.family === preferredFamily) ??
      profiles[0] ??
      {
        motion_id: `synth_${techniqueId}`,
        family: preferredFamily ?? "synthesized",
        duration_s: { nominal: 0.72 },
        evidence_level: "synthesized_runtime_fallback",
      };

    const clipName = `PROC_${techniqueId}_${profile.family}`;
    const existing = this.created.get(clipName);
    if (existing) return existing;

    const group = new AnimationGroup(clipName, this.scene);

    if (techniqueId === "jab") {
      this.buildLeadStraight(group, profile);
    } else if (techniqueId === "cross") {
      this.buildRearStraight(group, profile);
    } else if (
      techniqueId === "round_kick_body" ||
      techniqueId === "round_kick_head" ||
      techniqueId === "low_kick"
    ) {
      this.buildRoundKick(group, profile, techniqueId);
    } else if (techniqueId === "side_kick") {
      this.buildSideKick(group, profile);
    } else if (["lead_hook", "rear_hook"].includes(techniqueId)) {
      this.buildHook(group, profile, techniqueId);
    } else if (["lead_uppercut", "rear_uppercut"].includes(techniqueId)) {
      this.buildUppercut(group, profile, techniqueId);
    } else if (["overhand", "body_jab", "body_cross", "palm_strike", "backfist", "spinning_backfist"].includes(techniqueId)) {
      this.buildHandVariant(group, profile, techniqueId);
    } else if (["front_kick", "teep", "calf_kick", "spinning_back_kick", "axe_kick", "hook_kick", "crescent_kick", "question_mark_kick", "leg_kick_grounded"].includes(techniqueId)) {
      this.buildKickVariant(group, profile, techniqueId);
    } else if (["lead_knee", "rear_knee", "knee_head"].includes(techniqueId)) {
      this.buildKnee(group, profile, techniqueId);
    } else if (["lead_elbow", "rear_elbow", "spinning_elbow"].includes(techniqueId)) {
      this.buildElbow(group, profile, techniqueId);
    } else if (techniqueId === "soccer_kick_head") {
      this.buildSoccerKick(group, profile);
    } else if (techniqueId === "stomp_head" || techniqueId === "stomp_body") {
      this.buildStomp(group, profile, techniqueId);
    } else if (techniqueId === "grounded_knee_head") {
      this.buildGroundedKnee(group, profile);
    } else {
      return null;
    }

    if (!group.targetedAnimations.length) {
      group.dispose();
      return null;
    }

    this.created.set(clipName, group);
    return group;
  }

  buildDefaultSet(): AnimationGroup[] {
    const out: AnimationGroup[] = [];
    for (const technique of [
      "jab",
      "cross",
      "round_kick_body",
      "round_kick_head",
      "low_kick",
      "side_kick",
      "lead_knee",
      "rear_knee",
      "knee_head",
      "lead_elbow",
      "rear_elbow",
      "spinning_elbow",
      "soccer_kick_head",
      "stomp_head",
      "stomp_body",
      "grounded_knee_head",
    ]) {
      const profiles = motionProfilesForTechnique(technique);
      if (!profiles.length) {
        const group = this.buildTechnique(technique);
        if (group && !out.includes(group)) out.push(group);
        continue;
      }
      for (const profile of profiles) {
        const group = this.buildTechnique(technique, profile.family);
        if (group && !out.includes(group)) out.push(group);
      }
    }
    return out;
  }

  private addBone(
    group: AnimationGroup,
    boneId: RigBoneId,
    keys: EulerKey[],
    fps = 60
  ): void {
    const binding = this.rig.get(boneId);
    const node = binding?.node;
    if (!binding || !node) return;

    if (!node.rotationQuaternion) {
      node.rotationQuaternion = binding.restRotation.clone();
    }

    const animation = new Animation(
      `${group.name}_${boneId}`,
      "rotationQuaternion",
      fps,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    animation.setKeys(
      keys.map((k) => ({
        frame: Math.round(k.t * fps),
        value: multiplyRest(
          binding.restRotation,
          qFromDegrees(k.pitch, k.yaw, k.roll)
        ),
      }))
    );

    group.addTargetedAnimation(animation, node);
  }

  private durationFrames(profile: any, fallbackSeconds: number): number {
    const seconds =
      profile?.duration_s?.mean ??
      profile?.duration_s?.nominal ??
      fallbackSeconds;
    return Math.max(12, Math.round(seconds * 60));
  }

  private normalizedKeys(
    profile: any,
    values: Array<[number, number, number, number]>
  ): EulerKey[] {
    const duration = this.durationFrames(profile, 0.7);
    return values.map(([t, pitch, yaw, roll]) => ({
      t: (t * duration) / 60,
      pitch,
      yaw,
      roll,
    }));
  }

  private buildLeadStraight(group: AnimationGroup, profile: any): void {
    const trunkRom = profile?.kinematics?.trunk_rotation_rom_deg?.mean ?? 40;

    this.addBone(
      group,
      "chest",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.30, 0, trunkRom * 0.18, 0],
        [0.62, 0, trunkRom * 0.48, 0],
        [0.88, 0, trunkRom * 0.58, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "leftUpperArm",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.38, -18, -6, -8],
        [0.72, -62, -10, -5],
        [0.88, -78, -8, -2],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "leftForearm",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.42, 32, 0, 0],
        [0.72, 10, 0, 0],
        [0.88, 2, 0, 0],
        [1.00, 0, 0, 0],
      ])
    );
  }

  private buildRearStraight(group: AnimationGroup, profile: any): void {
    const trunkRom = profile?.kinematics?.trunk_rotation_rom_deg?.mean ?? 70;

    this.addBone(
      group,
      "hips",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.20, 0, -trunkRom * 0.16, 0],
        [0.50, 0, -trunkRom * 0.42, 0],
        [0.86, 0, -trunkRom * 0.48, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "chest",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.30, 0, -trunkRom * 0.20, 0],
        [0.58, 0, -trunkRom * 0.55, 0],
        [0.86, 0, -trunkRom * 0.68, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightUpperArm",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.40, -22, 8, 8],
        [0.66, -66, 12, 4],
        [0.86, -82, 8, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightForearm",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.40, 38, 0, 0],
        [0.66, 12, 0, 0],
        [0.86, 2, 0, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightFoot",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.20, 0, -10, 0],
        [0.55, 0, -28, 0],
        [0.86, 0, -34, 0],
        [1.00, 0, 0, 0],
      ])
    );
  }

  private buildRoundKick(
    group: AnimationGroup,
    profile: any,
    techniqueId: string
  ): void {
    const k = profile?.kinematics ?? {};
    const pelvisRom = k.pelvis_axial_rotation_rom_deg?.mean ?? 100;
    const chamber = k.max_knee_flexion_deg?.mean ?? 98;
    const impactKnee = k.knee_flexion_at_impact_deg?.mean ?? 25;
    const hipAbduction = k.hip_abduction_at_impact_deg?.mean ?? 50;

    const heightPitch =
      techniqueId === "round_kick_head"
        ? -35
        : techniqueId === "low_kick"
          ? 18
          : -5;

    this.addBone(
      group,
      "hips",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.20, 0, -pelvisRom * 0.16, 0],
        [0.55, 0, -pelvisRom * 0.58, 0],
        [0.82, 0, -pelvisRom * 0.82, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "leftFoot",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.18, 0, -28, 0],
        [0.48, 0, -72, 0],
        [0.82, 0, -96, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightThigh",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.28, -22 + heightPitch, 0, -18],
        [0.52, -54 + heightPitch, 0, -hipAbduction * 0.75],
        [0.82, -76 + heightPitch, 0, -hipAbduction],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightShin",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.38, chamber * 0.75, 0, 0],
        [0.58, chamber, 0, 0],
        [0.82, impactKnee, 0, 0],
        [1.00, 0, 0, 0],
      ])
    );
  }

  private buildSideKick(group: AnimationGroup, profile: any): void {
    const supportPivot =
      profile?.kinematics?.support_foot_rotation_deg?.min ?? 95;
    const chamber =
      profile?.kinematics?.chamber_knee_flexion_deg?.max ?? 120;

    this.addBone(
      group,
      "leftFoot",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.18, 0, -supportPivot * 0.45, 0],
        [0.58, 0, -supportPivot, 0],
        [0.86, 0, -supportPivot, 0],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightThigh",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.34, -62, 0, -26],
        [0.58, -78, 0, -42],
        [0.84, -88, 0, -54],
        [1.00, 0, 0, 0],
      ])
    );
    this.addBone(
      group,
      "rightShin",
      this.normalizedKeys(profile, [
        [0.00, 0, 0, 0],
        [0.34, chamber, 0, 0],
        [0.58, chamber * 0.60, 0, 0],
        [0.84, 8, 0, 0],
        [1.00, 0, 0, 0],
      ])
    );
  }

  private buildHook(group: AnimationGroup, profile: any, techniqueId: string): void {
    const lead = techniqueId === "lead_hook";
    const arm = lead ? "leftUpperArm" : "rightUpperArm";
    const fore = lead ? "leftForearm" : "rightForearm";
    const dir = lead ? 1 : -1;
    this.addBone(group, "hips", this.normalizedKeys(profile, [
      [0,0,0,0],[0.30,0,dir*10,0],[0.62,0,dir*28,0],[0.82,0,dir*34,0],[1,0,0,0],
    ]));
    this.addBone(group, "chest", this.normalizedKeys(profile, [
      [0,0,0,0],[0.30,0,dir*14,0],[0.62,0,dir*38,dir*5],[0.82,0,dir*46,dir*7],[1,0,0,0],
    ]));
    this.addBone(group, arm, this.normalizedKeys(profile, [
      [0,0,0,0],[0.32,-36,dir*12,dir*34],[0.66,-54,dir*24,dir*58],[0.82,-48,dir*32,dir*64],[1,0,0,0],
    ]));
    this.addBone(group, fore, this.normalizedKeys(profile, [
      [0,0,0,0],[0.32,72,0,0],[0.66,94,0,0],[0.82,88,0,0],[1,0,0,0],
    ]));
  }

  private buildUppercut(group: AnimationGroup, profile: any, techniqueId: string): void {
    const lead = techniqueId === "lead_uppercut";
    const arm = lead ? "leftUpperArm" : "rightUpperArm";
    const fore = lead ? "leftForearm" : "rightForearm";
    const dir = lead ? 1 : -1;
    this.addBone(group, "hips", this.normalizedKeys(profile, [
      [0,0,0,0],[0.25,8,dir*8,0],[0.55,-6,dir*18,0],[0.78,-12,dir*24,0],[1,0,0,0],
    ]));
    this.addBone(group, "chest", this.normalizedKeys(profile, [
      [0,0,0,0],[0.28,12,dir*8,0],[0.58,-10,dir*22,dir*4],[0.80,-18,dir*28,dir*5],[1,0,0,0],
    ]));
    this.addBone(group, arm, this.normalizedKeys(profile, [
      [0,0,0,0],[0.30,-28,dir*8,dir*18],[0.60,-54,dir*14,dir*30],[0.80,-68,dir*16,dir*34],[1,0,0,0],
    ]));
    this.addBone(group, fore, this.normalizedKeys(profile, [
      [0,0,0,0],[0.30,102,0,0],[0.60,88,0,0],[0.80,72,0,0],[1,0,0,0],
    ]));
  }

  private buildHandVariant(group: AnimationGroup, profile: any, techniqueId: string): void {
    if (techniqueId === "body_jab") {
      this.buildLeadStraight(group, profile);
      this.addBone(group, "chest", this.normalizedKeys(profile, [[0,0,0,0],[0.55,18,0,0],[0.88,14,0,0],[1,0,0,0]]));
      return;
    }
    if (techniqueId === "body_cross") {
      this.buildRearStraight(group, profile);
      this.addBone(group, "chest", this.normalizedKeys(profile, [[0,0,0,0],[0.55,18,0,0],[0.88,14,0,0],[1,0,0,0]]));
      return;
    }
    if (techniqueId === "palm_strike") {
      this.buildLeadStraight(group, profile);
      return;
    }

    const spinning = techniqueId === "spinning_backfist";
    this.addBone(group, "hips", this.normalizedKeys(profile, [
      [0,0,0,0],[0.28,0,spinning?-55:-12,0],[0.58,0,spinning?-145:-32,0],[0.80,0,spinning?-220:-44,0],[1,0,0,0],
    ]));
    this.addBone(group, "chest", this.normalizedKeys(profile, [
      [0,0,0,0],[0.30,0,spinning?-42:-18,0],[0.60,0,spinning?-125:-42,0],[0.82,0,spinning?-185:-52,0],[1,0,0,0],
    ]));
    this.addBone(group, "rightUpperArm", this.normalizedKeys(profile, [
      [0,0,0,0],[0.34,-30,10,30],[0.64,-66,18,54],[0.82,-78,24,62],[1,0,0,0],
    ]));
    this.addBone(group, "rightForearm", this.normalizedKeys(profile, [
      [0,0,0,0],[0.34,38,0,0],[0.64,20,0,0],[0.82,10,0,0],[1,0,0,0],
    ]));
  }

  private buildKickVariant(group: AnimationGroup, profile: any, techniqueId: string): void {
    const spin = techniqueId === "spinning_back_kick";
    const axe = techniqueId === "axe_kick";
    const hook = techniqueId === "hook_kick";
    const crescent = techniqueId === "crescent_kick";
    const question = techniqueId === "question_mark_kick";
    const calf = techniqueId === "calf_kick";
    const grounded = techniqueId === "leg_kick_grounded";
    const front = techniqueId === "front_kick" || techniqueId === "teep";

    this.addBone(group, "hips", this.normalizedKeys(profile, [
      [0,0,0,0],[0.24,0,spin?-55:-8,0],[0.56,0,spin?-145:(question?-40:-18),0],[0.80,0,spin?-220:(question?-72:-24),0],[1,0,0,0],
    ]));
    this.addBone(group, "rightThigh", this.normalizedKeys(profile, [
      [0,0,0,0],
      [0.30, front?-52:(axe?-92:(calf||grounded?-26:-64)), 0, hook?18:(crescent?-18:6)],
      [0.58, front?-78:(axe?-128:(calf||grounded?18:-88)), 0, hook?34:(crescent?-34:10)],
      [0.80, front?-86:(axe?42:(calf||grounded?42:-96)), spin?-8:0, hook?48:(crescent?-46:8)],
      [1,0,0,0],
    ]));
    this.addBone(group, "rightShin", this.normalizedKeys(profile, [
      [0,0,0,0],[0.30,82,0,0],[0.58,front?42:94,0,0],[0.80,front?8:(axe?6:18),0,0],[1,0,0,0],
    ]));
  }

  private buildKnee(group: AnimationGroup, profile: any, techniqueId: string): void {
    const lead = techniqueId === "lead_knee";
    const high = techniqueId === "knee_head";
    const thigh = lead ? "leftThigh" : "rightThigh";
    const shin = lead ? "leftShin" : "rightShin";

    this.addBone(group, "hips", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.28, 8, lead ? 8 : -8, 0],
      [0.56, -8, lead ? 14 : -14, 0],
      [0.80, -4, lead ? 10 : -10, 0],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, thigh, this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.34, -32, 0, lead ? -6 : 6],
      [0.64, high ? -92 : -70, 0, lead ? -10 : 10],
      [0.82, high ? -104 : -78, 0, lead ? -8 : 8],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, shin, this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.34, 58, 0, 0],
      [0.64, 92, 0, 0],
      [0.82, 82, 0, 0],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, "chest", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.36, high ? 12 : 6, lead ? -5 : 5, 0],
      [0.74, high ? 20 : 10, lead ? -8 : 8, 0],
      [1.00, 0, 0, 0],
    ]));
  }

  private buildElbow(group: AnimationGroup, profile: any, techniqueId: string): void {
    const lead = techniqueId === "lead_elbow";
    const spinning = techniqueId === "spinning_elbow";
    const arm = lead ? "leftUpperArm" : "rightUpperArm";
    const fore = lead ? "leftForearm" : "rightForearm";
    const dir = lead ? 1 : -1;

    this.addBone(group, "hips", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.30, 0, spinning ? -55 : dir * 10, 0],
      [0.62, 0, spinning ? -145 : dir * 28, 0],
      [0.82, 0, spinning ? -210 : dir * 34, 0],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, "chest", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.30, 0, spinning ? -40 : dir * 14, 0],
      [0.62, 0, spinning ? -120 : dir * 36, dir * 6],
      [0.82, 0, spinning ? -170 : dir * 44, dir * 8],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, arm, this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.34, -36, dir * 10, dir * 30],
      [0.66, -62, dir * 18, dir * 58],
      [0.82, -72, dir * 22, dir * 66],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, fore, this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.34, 76, 0, 0],
      [0.66, 112, 0, 0],
      [0.82, 118, 0, 0],
      [1.00, 0, 0, 0],
    ]));
  }

  private buildSoccerKick(group: AnimationGroup, profile: any): void {
    this.addBone(group, "hips", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.22, 8, -10, 0],
      [0.48, -8, -22, 0],
      [0.76, -16, -34, 0],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, "rightThigh", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.30, -34, 0, 4],
      [0.56, -78, 0, 10],
      [0.78, 42, 0, 8],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, "rightShin", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.34, 76, 0, 0],
      [0.56, 98, 0, 0],
      [0.78, 12, 0, 0],
      [1.00, 0, 0, 0],
    ]));
  }

  private buildStomp(group: AnimationGroup, profile: any, techniqueId: string): void {
    const body = techniqueId === "stomp_body";
    this.addBone(group, "hips", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.28, 8, 0, 0],
      [0.52, -8, 0, 0],
      [0.76, 16, 0, 0],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, "rightThigh", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.32, body ? -52 : -68, 0, 0],
      [0.58, body ? -72 : -88, 0, 0],
      [0.78, body ? 28 : 38, 0, 0],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, "rightShin", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.32, 72, 0, 0],
      [0.58, 92, 0, 0],
      [0.78, 8, 0, 0],
      [1.00, 0, 0, 0],
    ]));
  }

  private buildGroundedKnee(group: AnimationGroup, profile: any): void {
    this.addBone(group, "chest", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.28, 18, -8, 0],
      [0.58, 28, -14, 0],
      [0.82, 16, -8, 0],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, "rightThigh", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.30, -42, 0, 6],
      [0.60, -94, 0, 10],
      [0.80, -108, 0, 8],
      [1.00, 0, 0, 0],
    ]));
    this.addBone(group, "rightShin", this.normalizedKeys(profile, [
      [0.00, 0, 0, 0],
      [0.30, 62, 0, 0],
      [0.60, 102, 0, 0],
      [0.80, 88, 0, 0],
      [1.00, 0, 0, 0],
    ]));
  }

  dispose(): void {
    for (const group of this.created.values()) group.dispose();
    this.created.clear();
  }
}
