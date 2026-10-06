import { afterEach, describe, expect, it } from "vitest";
import {
  clearFighterPresets,
  deleteFighterPreset,
  listFighterPresets,
  saveFighterPreset,
} from "@/game/fighterPresetStore";

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

const preset = {
  version: 1 as const,
  name: "Tall Boxer",
  characterId: "fighter-a",
  setup: {
    name: "Tall Boxer",
    styleId: "boxing",
    stanceId: "boxing_orthodox",
    body: {
      massKg: 92,
      heightM: 1.98,
      reachM: 2.08,
      centerOfMassHeightRatio: 0.56,
    },
  },
};

describe("fighter preset store", () => {
  afterEach(() => {
    clearFighterPresets();
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it("saves and reloads a complete fighter build", () => {
    stubStorage();
    saveFighterPreset(preset);

    const saved = listFighterPresets();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("Tall Boxer");
    expect(saved[0].setup.styleId).toBe("boxing");
    expect(saved[0].setup.body.heightM).toBe(1.98);
  });

  it("preserves the linked moveset name", () => {
    stubStorage();
    saveFighterPreset({
      ...preset,
      movesetName: "Pressure",
    });

    expect(listFighterPresets()[0].movesetName).toBe("Pressure");
  });

  it("overwrites a preset with the same name", () => {
    stubStorage();
    saveFighterPreset(preset);
    saveFighterPreset({
      ...preset,
      setup: {
        ...preset.setup,
        body: { ...preset.setup.body, massKg: 105 },
      },
    });

    const saved = listFighterPresets();
    expect(saved).toHaveLength(1);
    expect(saved[0].setup.body.massKg).toBe(105);
  });

  it("normalizes out-of-range bodies before persistence", () => {
    stubStorage();
    saveFighterPreset({
      ...preset,
      name: "Extreme",
      setup: {
        ...preset.setup,
        body: {
          ...preset.setup.body,
          massKg: 999,
          heightM: 3,
          reachM: 4,
        },
      },
    });

    const saved = listFighterPresets()[0];
    expect(saved.setup.body.massKg).toBe(160);
    expect(saved.setup.body.heightM).toBe(2.1);
    expect(saved.setup.body.reachM).toBeCloseTo(2.352);
  });

  it("deletes a saved fighter build", () => {
    stubStorage();
    saveFighterPreset(preset);
    expect(deleteFighterPreset("Tall Boxer")).toBe(true);
    expect(listFighterPresets()).toEqual([]);
  });
});
