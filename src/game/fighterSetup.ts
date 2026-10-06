import { BODY_PHYSICS, styleById } from "@/data/combatCatalog";
import type { FighterLoadout } from "@/combat/mayQuvTypes";

export type FighterSetupInput =
  Pick<FighterLoadout, "styleId" | "stanceId" | "body"> & {
    name?: string;
  };

export function normalizeFighterSetup(
  characterId: string,
  setup: FighterSetupInput
): FighterLoadout {
  const bounds = BODY_PHYSICS.legal_body_envelope;
  const style = styleById(setup.styleId);

  const heightM = Math.min(
    bounds.max_height_m,
    Math.max(bounds.min_height_m, setup.body.heightM)
  );
  const massKg = Math.min(
    bounds.max_mass_kg,
    Math.max(bounds.min_mass_kg, setup.body.massKg)
  );

  const minReach = heightM * bounds.min_reach_to_height_ratio;
  const maxReach = heightM * bounds.max_reach_to_height_ratio;
  const reachM = Math.min(
    maxReach,
    Math.max(minReach, setup.body.reachM)
  );

  const centerOfMassHeightRatio = Math.min(
    bounds.center_of_mass_height_ratio.max,
    Math.max(
      bounds.center_of_mass_height_ratio.min,
      setup.body.centerOfMassHeightRatio
    )
  );

  return {
    id: characterId,
    name: setup.name?.trim() || characterId,
    styleId: style?.style_id ?? "boxing",
    stanceId:
      style?.default_stance === setup.stanceId
        ? setup.stanceId
        : style?.default_stance ?? "neutral_fighting",
    body: {
      massKg,
      heightM,
      reachM,
      centerOfMassHeightRatio,
    },
  };
}
