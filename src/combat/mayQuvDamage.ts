import damageJson from "#data/combat/damage-model.json";
import type {
  CombatResolution,
  FighterState,
  ImpactSample,
  TargetZone,
  TechniqueRuntime,
} from "./mayQuvTypes";
import { regionConsequences, regionFromTarget } from "./regionalCondition";
import { effectiveStrikeMass } from "@/game/bodyPhysics";

const target = damageJson.target_zones as Record<string, Record<string, number>>;
const quality = damageJson.contact_quality as Record<string, number>;
const guardAbsorb = damageJson.guard_absorption as Record<string, number>;

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function zoneFromRegion(region: NonNullable<ImpactSample["actualRegion"]>): TargetZone {
  switch (region) {
    case "head": return "head";
    case "body": return "body";
    case "leftArm": return "left_arm";
    case "rightArm": return "right_arm";
    case "leftLeg": return "left_leg";
    case "rightLeg": return "right_leg";
  }
}

function targetZoneFor(raw: string): TargetZone {
  switch (raw) {
    case "head":
    case "torso":
    case "left_arm":
    case "right_arm":
    case "left_leg":
    case "right_leg":
    case "neck":
      return raw;
    case "leg":
      return "left_leg";
    default:
      return "body";
  }
}


export function resolveTechniqueImpact(
  attacker: FighterState,
  defender: FighterState,
  technique: TechniqueRuntime,
  sample: ImpactSample
): CombatResolution {
  const zone = sample.actualRegion ? zoneFromRegion(sample.actualRegion) : targetZoneFor(technique.target);
  const zoneTuning = target[zone] ?? target.body ?? {};
  const region = regionFromTarget(zone);
  const attackerRegional = regionConsequences(attacker.condition);
  const defenderRegional = regionConsequences(defender.condition);
  let effectiveMassKg = effectiveStrikeMass(
    attacker.loadout.body,
    technique.weapon,
    technique.power
  );
  if (technique.weapon.includes("lead_hand") || technique.weapon.includes("lead_elbow")) effectiveMassKg *= attackerRegional.leftArmScale;
  if (technique.weapon.includes("rear_hand") || technique.weapon.includes("rear_elbow")) effectiveMassKg *= attackerRegional.rightArmScale;
  if (technique.weapon.includes("lead_leg") || technique.weapon.includes("lead_knee")) effectiveMassKg *= attackerRegional.leftLegScale;
  if (technique.weapon.includes("rear_leg") || technique.weapon.includes("rear_knee") || technique.weapon === "leg" || technique.weapon === "knee") effectiveMassKg *= attackerRegional.rightLegScale;
  const v = Math.max(0, sample.relativeVelocityMps);
  const impactEnergy = 0.5 * effectiveMassKg * v * v;

  const q = quality[sample.contactQuality] ?? 1;
  const absorbed = guardAbsorb[sample.guard] ?? 0;
  const guardScale = 1 - Math.max(0, Math.min(0.95, absorbed));

  // Normalizes energy into the 100 HP scale. Power remains technique geometry/
  // commitment, never a hidden fighter stat.
  const normalized = impactEnergy / 42;
  const hpMultiplier = zoneTuning.hp_multiplier ?? 1;
  const hpDamage = Math.max(
    0,
    Math.round(normalized * hpMultiplier * q * guardScale * 10) / 10
  );
  const consciousnessScale = region === "head" ? defenderRegional.koRiskScale : 1;
  const consciousnessDamage = Math.max(
    0,
    Math.round(
      normalized *
        (zoneTuning.consciousness_multiplier ?? 0.25) *
        q *
        guardScale *
        consciousnessScale *
        10
    ) / 10
  );
  const balanceScale = (region === "leftLeg" || region === "rightLeg") ? 1 / Math.max(0.45, defenderRegional.balanceScale) : 1;
  const balanceDamage = Math.max(
    0,
    Math.round(
      normalized *
        (zoneTuning.balance_multiplier ?? 0.2) *
        q *
        guardScale *
        balanceScale *
        10
    ) / 10
  );
  const regionalDamage = Math.max(
    0,
    Math.round(
      normalized *
        (zoneTuning.limb_multiplier ?? (region === "body" ? 0.85 : 1)) *
        q *
        guardScale *
        10
    ) / 10
  );

  const staminaSpent =
    sample.staminaCommitted ??
    Math.round(
      technique.staminaCost * attackerRegional.staminaCostScale * 10
    ) / 10;
  if (sample.staminaCommitted === undefined) {
    attacker.condition.stamina = clamp100(
      attacker.condition.stamina - staminaSpent
    );
  }
  defender.condition.hp = clamp100(defender.condition.hp - hpDamage);
  defender.condition.consciousness = clamp100(
    defender.condition.consciousness - consciousnessDamage
  );
  defender.condition.balance = clamp100(
    defender.condition.balance - balanceDamage
  );

  defender.condition.regions[region] = clamp100(
    defender.condition.regions[region] - regionalDamage
  );

  const knockedOut = defender.condition.consciousness <= 0 || defender.condition.hp <= 0;
  const forcedKnockdown =
    technique.type === "takedown" || technique.type === "throw";
  const knockedDown =
    !knockedOut &&
    (forcedKnockdown ||
      defender.condition.balance <= 15 * defenderRegional.balanceScale);

  return {
    eventType: technique.type === "strike" ? "strike_contact" : technique.type,
    techniqueId: technique.techniqueId,
    techniqueName: technique.name,
    hpDamage,
    consciousnessDamage,
    balanceDamage,
    staminaSpent,
    regionalDamage,
    targetRegion: region,
    effectiveMassKg: Math.round(effectiveMassKg * 100) / 100,
    impactEnergy: Math.round(impactEnergy * 100) / 100,
    knockedDown,
    knockedOut,
  };
}
