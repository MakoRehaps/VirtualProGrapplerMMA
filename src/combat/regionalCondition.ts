import type { FighterCondition, RegionalCondition } from "./mayQuvTypes";

export type RegionKey = keyof RegionalCondition;

export interface RegionConsequences {
  koRiskScale: number;
  staminaCostScale: number;
  leftArmScale: number;
  rightArmScale: number;
  leftLegScale: number;
  rightLegScale: number;
  movementScale: number;
  balanceScale: number;
}

export function regionConsequences(condition: FighterCondition): RegionConsequences {
  const head = condition.regions.head / 100;
  const body = condition.regions.body / 100;
  const leftArm = condition.regions.leftArm / 100;
  const rightArm = condition.regions.rightArm / 100;
  const leftLeg = condition.regions.leftLeg / 100;
  const rightLeg = condition.regions.rightLeg / 100;
  const worstLeg = Math.min(leftLeg, rightLeg);

  return {
    koRiskScale: 1 + (1 - head) * 0.85,
    staminaCostScale: 1 + (1 - body) * 0.65,
    leftArmScale: 0.55 + leftArm * 0.45,
    rightArmScale: 0.55 + rightArm * 0.45,
    leftLegScale: 0.50 + leftLeg * 0.50,
    rightLegScale: 0.50 + rightLeg * 0.50,
    movementScale: 0.55 + worstLeg * 0.45,
    balanceScale: 0.55 + worstLeg * 0.45,
  };
}

export function regionFromTarget(raw: string): RegionKey {
  switch (raw) {
    case "head":
    case "neck":
      return "head";
    case "torso":
    case "body":
      return "body";
    case "left_arm":
      return "leftArm";
    case "right_arm":
      return "rightArm";
    case "left_leg":
    case "leg":
      return "leftLeg";
    case "right_leg":
      return "rightLeg";
    default:
      return "body";
  }
}


export function guardLevelFromArmCondition(
  condition: FighterCondition,
  requested: "none" | "partial" | "solid"
): "none" | "partial" | "solid" {
  if (requested === "none") return "none";

  const averageArm =
    (condition.regions.leftArm + condition.regions.rightArm) / 2;

  if (averageArm < 25) return "none";
  if (averageArm < 60 && requested === "solid") return "partial";
  return requested;
}

export function canSustainWhizzer(condition: FighterCondition): boolean {
  const bestArm = Math.max(
    condition.regions.leftArm,
    condition.regions.rightArm
  );
  return bestArm >= 35;
}
