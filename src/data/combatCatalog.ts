import techniquesJson from "#data/combat/techniques.json";
import stylesJson from "#data/styles/styles.json";
import styleTechniquesJson from "#data/styles/style-techniques.json";
import stancesJson from "#data/stances/stances.json";
import bodyPhysicsJson from "#data/combat/body-physics.json";
import rulesetsJson from "#data/game/rulesets.json";
import competitionJson from "#data/game/competition.json";
import type { TechniqueRuntime } from "@/combat/mayQuvTypes";

export interface StyleRecord {
  style_id: string;
  name: string;
  default_stance: string;
  family: string[];
}

export interface StanceRecord {
  stance_id: string;
  name: string;
  movement: {
    forward: number;
    backward: number;
    lateral: number;
    pivot: number;
    burst: number;
  };
}

const techniqueMap = new Map(
  techniquesJson.techniques.map((t) => [
    t.technique_id,
    {
      techniqueId: t.technique_id,
      name: t.name,
      type: t.type,
      context: t.context,
      target: t.target,
      weapon: t.weapon,
      power: t.power,
      startupFrames: t.startup_frames,
      activeFrames: t.active_frames,
      recoveryFrames: t.recovery_frames,
      staminaCost: t.stamina_cost,
      tags: [...t.tags],
    } satisfies TechniqueRuntime,
  ])
);

const styleMap = new Map(stylesJson.styles.map((s) => [s.style_id, s]));
const stanceMap = new Map(stancesJson.stances.map((s) => [s.stance_id, s]));
const styleTechniqueMap = new Map(
  styleTechniquesJson.styles.map((s) => [s.style_id, new Set(s.technique_ids)])
);

export const BODY_PHYSICS = bodyPhysicsJson;
export const RULESETS = rulesetsJson.rulesets;
export const COMPETITION_MODES = competitionJson.modes;

export function techniqueById(id: string): TechniqueRuntime | null {
  return techniqueMap.get(id) ?? null;
}

export function styleById(id: string) {
  return styleMap.get(id) ?? null;
}

export function stanceById(id: string) {
  return stanceMap.get(id) ?? null;
}

export function styleAllowsTechnique(styleId: string, techniqueId: string): boolean {
  return styleTechniqueMap.get(styleId)?.has(techniqueId) ?? false;
}

export function techniquesForStyle(styleId: string): TechniqueRuntime[] {
  const allowed = styleTechniqueMap.get(styleId);
  if (!allowed) return [];
  return [...allowed]
    .map((id) => techniqueMap.get(id))
    .filter((x): x is TechniqueRuntime => Boolean(x));
}

export function rulesetById(id: string) {
  return RULESETS.find((r) => r.ruleset_id === id) ?? null;
}

export function competitionModeById(id: string) {
  return COMPETITION_MODES.find((m) => m.mode_id === id) ?? null;
}
