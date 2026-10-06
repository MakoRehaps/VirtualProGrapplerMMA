import { BODY_PHYSICS, stanceById } from "@/data/combatCatalog";
import type { FighterBody } from "@/combat/mayQuvTypes";

const REFERENCE_MASS_KG = 77;
const BASE_ACCEL = 8.0;
const BASE_WALK_SPEED = 2.4;
const BASE_RUN_SPEED = 4.8;
const BASE_PIVOT = 1.0;

function bodyClassForMass(massKg: number) {
  return (
    BODY_PHYSICS.body_classes.find(
      (c) => massKg >= c.min_mass_kg && massKg <= c.max_mass_kg
    ) ?? BODY_PHYSICS.body_classes[BODY_PHYSICS.body_classes.length - 1]
  );
}

export interface MovementPhysics {
  acceleration: number;
  walkSpeed: number;
  runSpeed: number;
  pivotScale: number;
  pushResistance: number;
}

export function deriveMovementPhysics(
  body: FighterBody,
  stanceId: string
): MovementPhysics {
  const bodyClass = bodyClassForMass(body.massKg);
  const p = bodyClass.physics;
  const stance = stanceById(stanceId);
  const forward = stance ? Math.max(0.45, stance.movement.forward / 100) : 0.75;
  const burst = stance ? Math.max(0.45, stance.movement.burst / 100) : 0.75;
  const pivot = stance ? Math.max(0.45, stance.movement.pivot / 100) : 0.75;

  const massRatio = REFERENCE_MASS_KG / Math.max(40, body.massKg);
  const acceleration =
    BASE_ACCEL * forward * Math.pow(massRatio, p.acceleration_mass_exponent);
  const inertia =
    Math.pow(body.massKg / REFERENCE_MASS_KG, p.rotational_inertia_mass_exponent);

  return {
    acceleration,
    walkSpeed: BASE_WALK_SPEED * (0.78 + forward * 0.28),
    runSpeed: BASE_RUN_SPEED * (0.78 + burst * 0.28),
    pivotScale: (BASE_PIVOT * pivot) / Math.max(0.65, inertia),
    pushResistance: Math.pow(
      body.massKg / REFERENCE_MASS_KG,
      p.push_resistance_mass_exponent
    ),
  };
}

export function effectiveStrikeMass(
  body: FighterBody,
  weapon: string,
  power: number
): number {
  const limbRatio =
    weapon.includes("leg") || weapon.includes("knee") ? 0.19 :
    weapon.includes("hip") || weapon === "body" ? 0.36 :
    weapon.includes("head") ? 0.11 :
    weapon.includes("elbow") ? 0.10 :
    0.08;

  const techniqueTransfer = 0.55 + Math.min(100, Math.max(0, power)) * 0.004;
  return body.massKg * limbRatio * techniqueTransfer;
}
