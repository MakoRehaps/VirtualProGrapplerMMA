import {
  normalizeFighterSetup,
  type FighterSetupInput,
} from "./fighterSetup";

const STORAGE_KEY = "may-quv-fighter-presets-v1";

export interface FighterPreset {
  version: 1;
  name: string;
  characterId: string;
  movesetName?: string;
  setup: FighterSetupInput;
}

interface Store {
  version: 1;
  presets: FighterPreset[];
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function read(): Store {
  const store = storage();
  if (!store) return { version: 1, presets: [] };

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, presets: [] };

    const parsed = JSON.parse(raw) as Partial<Store>;
    if (parsed.version !== 1 || !Array.isArray(parsed.presets)) {
      return { version: 1, presets: [] };
    }

    const presets = parsed.presets.filter((preset) => {
      if (
        preset?.version !== 1 ||
        typeof preset.name !== "string" ||
        typeof preset.characterId !== "string" ||
        !preset.setup
      ) {
        return false;
      }

      try {
        normalizeFighterSetup(preset.characterId, preset.setup);
        return true;
      } catch {
        return false;
      }
    });

    return { version: 1, presets };
  } catch {
    return { version: 1, presets: [] };
  }
}

function write(data: Store): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage failure must never block local play.
  }
}

export function listFighterPresets(): FighterPreset[] {
  return read().presets.map((preset) => ({
    ...preset,
    setup: {
      ...preset.setup,
      body: { ...preset.setup.body },
    },
  }));
}

export function saveFighterPreset(preset: FighterPreset): void {
  const normalized = normalizeFighterSetup(
    preset.characterId,
    preset.setup
  );

  const clean: FighterPreset = {
    version: 1,
    name: preset.name.trim() || normalized.name,
    characterId: preset.characterId,
    movesetName: preset.movesetName?.trim() || undefined,
    setup: {
      name: normalized.name,
      styleId: normalized.styleId,
      stanceId: normalized.stanceId,
      body: { ...normalized.body },
    },
  };

  const data = read();
  const index = data.presets.findIndex((x) => x.name === clean.name);
  if (index >= 0) data.presets[index] = clean;
  else data.presets.push(clean);
  write(data);
}

export function deleteFighterPreset(name: string): boolean {
  const data = read();
  const before = data.presets.length;
  data.presets = data.presets.filter((x) => x.name !== name);
  if (data.presets.length === before) return false;
  write(data);
  return true;
}

export function clearFighterPresets(): void {
  storage()?.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY as FIGHTER_PRESET_STORAGE_KEY };
