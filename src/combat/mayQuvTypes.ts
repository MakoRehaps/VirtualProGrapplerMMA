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

export interface LimbCondition {
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
  limbs: LimbCondition;
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
}

export interface CombatResolution {
  eventType: string;
  techniqueId: string;
  techniqueName: string;
  hpDamage: number;
  consciousnessDamage: number;
  balanceDamage: number;
  staminaSpent: number;
  limbDamage: number;
  targetZone: TargetZone;
  effectiveMassKg: number;
  impactEnergy: number;
  knockedDown: boolean;
  knockedOut: boolean;
}

export const MAX_HP = 100;
export const MAX_STAMINA = 100;
export const MAX_CONSCIOUSNESS = 100;
export const MAX_BALANCE = 100;
export const MAX_LIMB_CONDITION = 100;

export function freshCondition(): FighterCondition {
  return {
    hp: MAX_HP,
    stamina: MAX_STAMINA,
    consciousness: MAX_CONSCIOUSNESS,
    balance: MAX_BALANCE,
    limbs: { leftArm: 100, rightArm: 100, leftLeg: 100, rightLeg: 100 },
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
