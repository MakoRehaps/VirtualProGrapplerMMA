import { afterEach, describe, expect, it } from "vitest";
import { createDefaultMoveset } from "@/combat/moveset";
import {
  clearMovesets,
  deleteMoveset,
  listMovesets,
  loadMoveset,
  saveMoveset,
} from "@/combat/movesetStore";

function stubStorage() {
  const data = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
}

describe("moveset preset store", () => {
  afterEach(() => {
    clearMovesets();
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("saves and reloads a free custom preset", () => {
    stubStorage();
    const moveset = createDefaultMoveset("adimurai", "Pressure");
    saveMoveset(moveset);

    expect(listMovesets("adimurai")).toHaveLength(1);
    expect(loadMoveset("adimurai", "Pressure")?.name).toBe("Pressure");
  });

  it("replaces a preset with the same style and name", () => {
    stubStorage();
    const moveset = createDefaultMoveset("adimurai", "Pressure");
    saveMoveset(moveset);
    saveMoveset({
      ...moveset,
      slots: { ...moveset.slots, standing_a: "cross" },
    });

    expect(listMovesets("adimurai")).toHaveLength(1);
    expect(loadMoveset("adimurai", "Pressure")?.slots.standing_a).toBe("cross");
  });

  it("deletes presets without affecting combat unlocks", () => {
    stubStorage();
    const moveset = createDefaultMoveset("adimurai", "Pressure");
    saveMoveset(moveset);

    expect(deleteMoveset("adimurai", "Pressure")).toBe(true);
    expect(listMovesets("adimurai")).toEqual([]);
  });
});
