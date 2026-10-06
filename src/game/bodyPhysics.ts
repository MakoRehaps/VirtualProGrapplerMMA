import { BODY_PHYSICS, stanceById } from "@/data/combatCatalog";
import type { FighterBody } from "@/combat/mayQuvTypes";

const BASE_ACCEL = 8.0;
const BASE_WALK_SPEED = 2.4;
const BASE_RUN_SPEED = 4.8;
const BASE_PIVOT = 1.0;

export interface MovementPhysics {
  acceleration: number;
  walkSpeed: number;
  runSpeed: number;
  pivotScale: number;
  pushResistance: number;
}

export interface BodyValidation {
  valid: boolean;
  errors: string[];
}

export function validateFighterBody(body: FighterBody): BodyValidation {
  const e = BODY_PHYSICS.legal_body_envelope;
  const errors: string[] = [];

  if (body.massKg < e.min_mass_kg || body.massKg > e.max_mass_kg) {
    errors.push(
      `mass must be ${e.min_mass_kg}-${e.max_mass_kg} kg, got ${body.massKg}`
    );
  }
  if (body.heightM < e.min_height_m || body.heightM > e.max_height_m) {
    errors.push(
      `height must be ${e.min_height_m}-${e.max_height_m} m, got ${body.heightM}`
    );
  }

  const reachRatio = body.reachM / Math.max(0.01, body.heightM);
  if (
    reachRatio < e.min_reach_to_height_ratio ||
    reachRatio > e.max_reach_to_height_ratio
  ) {
    errors.push(
      `reach/height ratio must be ${e.min_reach_to_height_ratio}-${e.max_reach_to_height_ratio}, got ${reachRatio.toFixed(3)}`
    );
  }

  const com = body.centerOfMassHeightRatio;
  if (
    com < e.center_of_mass_height_ratio.min ||
    com > e.center_of_mass_height_ratio.max
  ) {
    errors.push(
      `center-of-mass ratio must be ${e.center_of_mass_height_ratio.min}-${e.center_of_mass_height_ratio.max}, got ${com}`
    );
  }

  return { valid: errors.length === 0, errors };
}

export function clampFighterBody(body: FighterBody): FighterBody {
  const e = BODY_PHYSICS.legal_body_envelope;
  const heightM = Math.max(e.min_height_m, Math.min(e.max_height_m, body.heightM));
  const massKg = Math.max(e.min_mass_kg, Math.min(e.max_mass_kg, body.massKg));
  const minReach = heightM * e.min_reach_to_height_ratio;
  const maxReach = heightM * e.max_reach_to_height_ratio;

  return {
    massKg,
    heightM,
    reachM: Math.max(minReach, Math.min(maxReach, body.reachM)),
    centerOfMassHeightRatio: Math.max(
      e.center_of_mass_height_ratio.min,
      Math.min(e.center_of_mass_height_ratio.max, body.centerOfMassHeightRatio)
    ),
  };
}

export function deriveMovementPhysics(
  inputBody: FighterBody,
  stanceId: string
): MovementPhysics {
  const body = clampFighterBody(inputBody);
  const p = BODY_PHYSICS.physics;
  const ref = BODY_PHYSICS.reference_body;
  const stance = stanceById(stanceId);
  const forward = stance ? Math.max(0.45, stance.movement.forward / 100) : 0.75;
  const burst = stance ? Math.max(0.45, stance.movement.burst / 100) : 0.75;
  const pivot = stance ? Math.max(0.45, stance.movement.pivot / 100) : 0.75;

  const massRatio = ref.mass_kg / body.massKg;
  const heightRatio = body.heightM / ref.height_m;

  const acceleration =
    BASE_ACCEL *
    forward *
    Math.pow(massRatio, p.acceleration_mass_exponent);

  const rotationalInertia =
    Math.pow(body.massKg / ref.mass_kg, p.rotational_inertia_mass_exponent);

  const strideScale = Math.pow(heightRatio, p.height_stride_exponent);
  const heightBalanceScale = Math.pow(
    ref.height_m / body.heightM,
    p.height_balance_exponent
  );

  return {
    acceleration,
    walkSpeed: BASE_WALK_SPEED * (0.78 + forward * 0.28) * strideScale,
    runSpeed: BASE_RUN_SPEED * (0.78 + burst * 0.28) * strideScale,
    pivotScale:
      (BASE_PIVOT * pivot * heightBalanceScale) /
      Math.max(0.65, rotationalInertia),
    pushResistance:
      Math.pow(
        body.massKg / ref.mass_kg,
        p.push_resistance_mass_exponent
      ) * heightBalanceScale,
  };
}

export function effectiveStrikeMass(
  inputBody: FighterBody,
  weapon: string,
  power: number
): number {
  const body = clampFighterBody(inputBody);

  const limbRatio =
    weapon.includes("leg") || weapon.includes("knee")
      ? 0.19
      : weapon.includes("hip") || weapon === "body"
        ? 0.36
        : weapon.includes("head")
          ? 0.11
          : weapon.includes("elbow")
            ? 0.10
            : 0.08;

  const techniqueTransfer =
    0.55 + Math.min(100, Math.max(0, power)) * 0.004;

  return body.massKg * limbRatio * techniqueTransfer;
}
