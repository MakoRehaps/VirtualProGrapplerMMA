import type { FighterMoveset } from "./moveset";
import { validateMoveset } from "./moveset";

const STORAGE_KEY = "may-quv-movesets-v1";

export interface StoredMovesets {
  version: 1;
  presets: FighterMoveset[];
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readStore(): StoredMovesets {
  const store = storage();
  if (!store) return { version: 1, presets: [] };

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, presets: [] };

    const parsed = JSON.parse(raw) as Partial<StoredMovesets>;
    if (parsed.version !== 1 || !Array.isArray(parsed.presets)) {
      return { version: 1, presets: [] };
    }

    return {
      version: 1,
      presets: parsed.presets.filter((moveset) => {
        try {
          return validateMoveset(moveset).valid;
        } catch {
          return false;
        }
      }),
    };
  } catch {
    return { version: 1, presets: [] };
  }
}

function writeStore(data: StoredMovesets): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage may be blocked/full. Gameplay must still work in memory.
  }
}

export function listMovesets(styleId?: string): FighterMoveset[] {
  const presets = readStore().presets;
  return styleId
    ? presets.filter((x) => x.styleId === styleId)
    : presets;
}

export function loadMoveset(
  styleId: string,
  name: string
): FighterMoveset | null {
  return (
    readStore().presets.find(
      (x) => x.styleId === styleId && x.name === name
    ) ?? null
  );
}

export function saveMoveset(moveset: FighterMoveset): void {
  const validation = validateMoveset(moveset);
  if (!validation.valid) {
    throw new Error(validation.errors.join("; "));
  }

  const data = readStore();
  const index = data.presets.findIndex(
    (x) => x.styleId === moveset.styleId && x.name === moveset.name
  );

  const copy: FighterMoveset = {
    ...moveset,
    slots: { ...moveset.slots },
  };

  if (index >= 0) data.presets[index] = copy;
  else data.presets.push(copy);

  writeStore(data);
}

export function deleteMoveset(styleId: string, name: string): boolean {
  const data = readStore();
  const before = data.presets.length;
  data.presets = data.presets.filter(
    (x) => !(x.styleId === styleId && x.name === name)
  );
  if (data.presets.length === before) return false;
  writeStore(data);
  return true;
}

export function clearMovesets(): void {
  storage()?.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY as MOVESET_STORAGE_KEY };
