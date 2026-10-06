import type {
  FighterState,
  TechniqueRuntime,
} from "./mayQuvTypes";
import { regionConsequences, regionFromTarget } from "./regionalCondition";

export interface SubmissionResolution {
  targetRegion: ReturnType<typeof regionFromTarget>;
  pressure: number;
  escapeCapacity: number;
  regionalDamage: number;
  consciousnessDamage: number;
  tapped: boolean;
  escaped: boolean;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deterministic submission resolution.
 *
 * This deliberately uses existing physical condition/stamina rather than a
 * hidden submission stat. Chokes attack consciousness; joint locks attack the
 * targeted regional condition. Severe existing damage makes a tap more
 * likely, while defender stamina represents available escape work.
 */
export function resolveSubmission(
  attacker: FighterState,
  defender: FighterState,
  technique: TechniqueRuntime
): SubmissionResolution {
  if (technique.type !== "submission") {
    throw new Error(`${technique.techniqueId} is not a submission`);
  }

  const region = regionFromTarget(technique.target);
  const attackerCondition = regionConsequences(attacker.condition);
  const defenderCondition = regionConsequences(defender.condition);

  const attackStamina =
    clamp(attacker.condition.stamina) / 100;
  const defenseStamina =
    clamp(defender.condition.stamina) / 100;

  const targetHealth =
    clamp(defender.condition.regions[region]) / 100;

  const basePressure =
    34 +
    technique.staminaCost * 1.4 +
    (1 - targetHealth) * 28 +
    (1 - attackStamina) * -8;

  const armControl =
    technique.weapon === "arms" || technique.weapon === "arm"
      ? (attackerCondition.leftArmScale +
          attackerCondition.rightArmScale) /
        2
      : 1;

  const legControl =
    technique.weapon === "legs" || technique.weapon === "leg"
      ? (attackerCondition.leftLegScale +
          attackerCondition.rightLegScale) /
        2
      : 1;

  const pressure =
    Math.round(
      clamp(basePressure * armControl * legControl, 0, 100) * 10
    ) / 10;

  const escapeCapacity =
    Math.round(
      clamp(
        defenseStamina * 55 +
          targetHealth * 25 +
          defenderCondition.balanceScale * 20,
        0,
        100
      ) * 10
    ) / 10;

  const choke =
    technique.target === "neck" ||
    technique.tags.includes("choke");

  const margin = pressure - escapeCapacity;
  const tapped = margin >= 8;
  const escaped = margin <= -8;

  const regionalDamage = Math.round(
    clamp(choke ? pressure * 0.12 : pressure * 0.28, 0, 30) * 10
  ) / 10;

  const consciousnessDamage = Math.round(
    clamp(choke ? pressure * 0.42 : pressure * 0.04, 0, 45) * 10
  ) / 10;

  if (!tapped) {
    defender.condition.regions[region] = Math.max(
      0,
      Math.round(
        (defender.condition.regions[region] - regionalDamage) * 10
      ) / 10
    );
    defender.condition.consciousness = Math.max(
      0,
      Math.round(
        (defender.condition.consciousness - consciousnessDamage) * 10
      ) / 10
    );
  }

  return {
    targetRegion: region,
    pressure,
    escapeCapacity,
    regionalDamage: tapped ? 0 : regionalDamage,
    consciousnessDamage: tapped ? 0 : consciousnessDamage,
    tapped,
    escaped,
  };
}
