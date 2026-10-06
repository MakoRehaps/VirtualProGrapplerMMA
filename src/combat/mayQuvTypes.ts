export type CombatSide = "player" | "opponent";

export type TargetZone =
  | "head"
  | "torso"
  | "left_arm"
  | "right_arm"
  | "left_leg"
  | "right_leg"
  | "neck"
  | "body";

export interface FighterBody {
  massKg: number;
  heightM: number;
  reachM: number;
  centerOfMassHeightRatio: number;
}

export interface FighterLoadout {
  id: string;
  name: string;
  styleId: string;
  stanceId: string;
  body: FighterBody;
}

export interface RegionalCondition {
  head: number;
  body: number;
  leftArm: number;
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
}

export interface FighterCondition {
  hp: number;
  stamina: number;
  consciousness: number;
  balance: number;
  regions: RegionalCondition;
}

export interface FighterState {
  loadout: FighterLoadout;
  condition: FighterCondition;
  positionId: string;
  guarding: boolean;
}

export interface TechniqueRuntime {
  techniqueId: string;
  name: string;
  type: string;
  context: string;
  target: string;
  weapon: string;
  power: number;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  staminaCost: number;
  tags: string[];
}

export interface ImpactSample {
  relativeVelocityMps: number;
  contactQuality: "glancing" | "partial" | "clean" | "perfect";
  guard: "none" | "partial" | "solid";
  actualRegion?: keyof RegionalCondition;
}

export interface RegionalEffects {
  headKoVulnerability: number;
  bodyStaminaPenalty: number;
  leftArmOutput: number;
  rightArmOutput: number;
  leftLegMobility: number;
  rightLegMobility: number;
  balanceScale: number;
}

export interface CombatResolution {
  eventType: string;
  techniqueId: string;
  techniqueName: string;
  hpDamage: number;
  consciousnessDamage: number;
  balanceDamage: number;
  staminaSpent: number;
  regionalDamage: number;
  targetRegion: keyof RegionalCondition;
  effectiveMassKg: number;
  impactEnergy: number;
  knockedDown: boolean;
  knockedOut: boolean;
}

export const MAX_HP = 100;
export const MAX_STAMINA = 100;
export const MAX_CONSCIOUSNESS = 100;
export const MAX_BALANCE = 100;
export const MAX_REGION_CONDITION = 100;

export function freshCondition(): FighterCondition {
  return {
    hp: MAX_HP,
    stamina: MAX_STAMINA,
    consciousness: MAX_CONSCIOUSNESS,
    balance: MAX_BALANCE,
    regions: {
      head: 100,
      body: 100,
      leftArm: 100,
      rightArm: 100,
      leftLeg: 100,
      rightLeg: 100,
    },
  };
}

export function createFighterState(loadout: FighterLoadout): FighterState {
  return {
    loadout,
    condition: freshCondition(),
    positionId: "standing_open",
    guarding: false,
  };
}

export function regionalEffects(condition: FighterCondition): RegionalEffects {
  const headWear = 1 - condition.regions.head / 100;
  const bodyWear = 1 - condition.regions.body / 100;
  const leftArm = condition.regions.leftArm / 100;
  const rightArm = condition.regions.rightArm / 100;
  const leftLeg = condition.regions.leftLeg / 100;
  const rightLeg = condition.regions.rightLeg / 100;
  const worstLeg = Math.min(leftLeg, rightLeg);

  return {
    headKoVulnerability: 1 + headWear * 0.85,
    bodyStaminaPenalty: 1 + bodyWear * 0.65,
    leftArmOutput: 0.55 + leftArm * 0.45,
    rightArmOutput: 0.55 + rightArm * 0.45,
    leftLegMobility: 0.5 + leftLeg * 0.5,
    rightLegMobility: 0.5 + rightLeg * 0.5,
    balanceScale: 0.55 + worstLeg * 0.45,
  };
}
