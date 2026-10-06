import movesetLayoutJson from "#data/game/moveset-layout.json";
import {
  activeTechniquesForStyle,
  isTechniqueActive,
  styleAllowsTechnique,
  techniqueById,
} from "@/data/combatCatalog";

export type MovesetButton = "a" | "b" | "x" | "y";
export type MovesetContext = "standing" | "clinch" | "grounded_opponent";

export interface FighterMoveset {
  version: 1;
  name: string;
  styleId: string;
  slots: Record<string, string | null>;
}

export interface MovesetValidation {
  valid: boolean;
  errors: string[];
}

export const MOVESET_LAYOUT = movesetLayoutJson;

const CONTEXT_ORDER: MovesetContext[] = [
  "standing",
  "clinch",
  "grounded_opponent",
];

const DEFAULT_PRIORITY: Record<MovesetContext, string[]> = {
  standing: [
    "jab",
    "cross",
    "low_kick",
    "round_kick_body",
    "front_kick",
    "side_kick",
    "lead_hook",
    "rear_hook",
  ],
  clinch: [
    "lead_knee",
    "rear_knee",
    "lead_elbow",
    "rear_elbow",
    "knee_head",
    "inside_trip",
    "outside_trip",
    "body_lock_trip",
    "osoto_gari",
  ],
  grounded_opponent: [
    "soccer_kick_head",
    "stomp_body",
    "stomp_head",
    "grounded_knee_head",
    "leg_kick_grounded",
  ],
};

export function movesetContextForPosition(
  positionId: string
): MovesetContext | null {
  for (const context of CONTEXT_ORDER) {
    const def = MOVESET_LAYOUT.contexts[context];
    if ((def.position_ids as string[]).includes(positionId)) return context;
  }
  return null;
}

export function slotIdFor(
  positionId: string,
  button: MovesetButton
): string | null {
  const context = movesetContextForPosition(positionId);
  if (!context) return null;

  const slot = MOVESET_LAYOUT.contexts[context].slots.find(
    (s) => s.button === button
  );
  return slot?.slot_id ?? null;
}

export function techniqueForMovesetInput(
  moveset: FighterMoveset,
  positionId: string,
  button: MovesetButton
): string | null {
  const slotId = slotIdFor(positionId, button);
  if (!slotId) return null;

  const techniqueId = moveset.slots[slotId] ?? null;
  if (!techniqueId) return null;

  const technique = techniqueById(techniqueId);
  if (!technique) return null;
  if (!styleAllowsTechnique(moveset.styleId, techniqueId)) return null;
  if (!isTechniqueActive(technique)) return null;

  const context = movesetContextForPosition(positionId);
  if (!context) return null;

  const allowedContexts =
    MOVESET_LAYOUT.contexts[context].technique_contexts as string[];
  if (!allowedContexts.includes(technique.context)) return null;

  return techniqueId;
}

export function validateMoveset(moveset: FighterMoveset): MovesetValidation {
  const errors: string[] = [];

  if (moveset.version !== 1) errors.push("unsupported moveset version");
  if (!moveset.name.trim()) errors.push("moveset name is required");

  const knownSlotIds = new Set(
    CONTEXT_ORDER.flatMap((context) =>
      MOVESET_LAYOUT.contexts[context].slots.map((s) => s.slot_id)
    )
  );

  for (const [slotId, techniqueId] of Object.entries(moveset.slots)) {
    if (!knownSlotIds.has(slotId)) {
      errors.push(`unknown moveset slot ${slotId}`);
      continue;
    }
    if (techniqueId === null) continue;

    const technique = techniqueById(techniqueId);
    if (!technique) {
      errors.push(`slot ${slotId} references missing technique ${techniqueId}`);
      continue;
    }
    if (!styleAllowsTechnique(moveset.styleId, techniqueId)) {
      errors.push(
        `style ${moveset.styleId} does not allow technique ${techniqueId}`
      );
    }
    if (!isTechniqueActive(technique)) {
      errors.push(`technique ${techniqueId} is disabled by active rules`);
    }

    const context = CONTEXT_ORDER.find((ctx) =>
      MOVESET_LAYOUT.contexts[ctx].slots.some((s) => s.slot_id === slotId)
    );
    if (!context) continue;

    const allowedContexts =
      MOVESET_LAYOUT.contexts[context].technique_contexts as string[];
    if (!allowedContexts.includes(technique.context)) {
      errors.push(
        `technique ${techniqueId} cannot be assigned to ${context} slot ${slotId}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

function candidatesForContext(
  styleId: string,
  context: MovesetContext
): string[] {
  const legal = activeTechniquesForStyle(styleId).filter((technique) =>
    (MOVESET_LAYOUT.contexts[context].technique_contexts as string[]).includes(
      technique.context
    )
  );

  const legalIds = new Set(legal.map((x) => x.techniqueId));
  const ordered = DEFAULT_PRIORITY[context].filter((id) => legalIds.has(id));

  for (const technique of legal) {
    if (!ordered.includes(technique.techniqueId)) {
      ordered.push(technique.techniqueId);
    }
  }

  return ordered;
}

export function createDefaultMoveset(
  styleId: string,
  name = "Default"
): FighterMoveset {
  const slots: Record<string, string | null> = {};

  for (const context of CONTEXT_ORDER) {
    const candidates = candidatesForContext(styleId, context);
    const contextSlots = MOVESET_LAYOUT.contexts[context].slots;

    contextSlots.forEach((slot, index) => {
      slots[slot.slot_id] =
        candidates[index] ??
        candidates[index % Math.max(1, candidates.length)] ??
        null;
    });
  }

  return {
    version: 1,
    name,
    styleId,
    slots,
  };
}

export function assignTechnique(
  moveset: FighterMoveset,
  slotId: string,
  techniqueId: string | null
): FighterMoveset {
  const next: FighterMoveset = {
    ...moveset,
    slots: { ...moveset.slots, [slotId]: techniqueId },
  };

  const validation = validateMoveset(next);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  return next;
}
