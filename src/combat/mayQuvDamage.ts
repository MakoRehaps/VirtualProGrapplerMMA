import damageJson from "#data/combat/damage-model.json";
import type {
  CombatResolution,
  FighterState,
  ImpactSample,
  TargetZone,
  TechniqueRuntime,
} from "./mayQuvTypes";
import { effectiveStrikeMass } from "@/game/bodyPhysics";

const target = damageJson.target_zones as Record<string, Record<string, number>>;
const quality = damageJson.contact_quality as Record<string, number>;
const guardAbsorb = damageJson.guard_absorption as Record<string, number>;

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
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

function limbKey(zone: TargetZone): keyof FighterState["condition"]["limbs"] | null {
  if (zone === "left_arm") return "leftArm";
  if (zone === "right_arm") return "rightArm";
  if (zone === "left_leg") return "leftLeg";
  if (zone === "right_leg") return "rightLeg";
  return null;
}

export function resolveTechniqueImpact(
  attacker: FighterState,
  defender: FighterState,
  technique: TechniqueRuntime,
  sample: ImpactSample
): CombatResolution {
  const zone = targetZoneFor(technique.target);
  const zoneTuning = target[zone] ?? target.body ?? {};
  const effectiveMassKg = effectiveStrikeMass(
    attacker.loadout.body,
    technique.weapon,
    technique.power
  );
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
  const consciousnessDamage = Math.max(
    0,
    Math.round(
      normalized *
        (zoneTuning.consciousness_multiplier ?? 0.25) *
        q *
        guardScale *
        10
    ) / 10
  );
  const balanceDamage = Math.max(
    0,
    Math.round(
      normalized *
        (zoneTuning.balance_multiplier ?? 0.2) *
        q *
        guardScale *
        10
    ) / 10
  );
  const limbDamage = Math.max(
    0,
    Math.round(
      normalized *
        (zoneTuning.limb_multiplier ?? 0) *
        q *
        guardScale *
        10
    ) / 10
  );

  attacker.condition.stamina = clamp100(
    attacker.condition.stamina - technique.staminaCost
  );
  defender.condition.hp = clamp100(defender.condition.hp - hpDamage);
  defender.condition.consciousness = clamp100(
    defender.condition.consciousness - consciousnessDamage
  );
  defender.condition.balance = clamp100(
    defender.condition.balance - balanceDamage
  );

  const lk = limbKey(zone);
  if (lk) {
    defender.condition.limbs[lk] = clamp100(
      defender.condition.limbs[lk] - limbDamage
    );
  }

  const knockedOut = defender.condition.consciousness <= 0 || defender.condition.hp <= 0;
  const knockedDown = !knockedOut && defender.condition.balance <= 15;

  return {
    eventType: technique.type === "strike" ? "strike_contact" : technique.type,
    techniqueId: technique.techniqueId,
    techniqueName: technique.name,
    hpDamage,
    consciousnessDamage,
    balanceDamage,
    staminaSpent: technique.staminaCost,
    limbDamage,
    targetZone: zone,
    effectiveMassKg: Math.round(effectiveMassKg * 100) / 100,
    impactEnergy: Math.round(impactEnergy * 100) / 100,
    knockedDown,
    knockedOut,
  };
}
