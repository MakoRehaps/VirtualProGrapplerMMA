import { describe, expect, it } from "vitest";
import {
  assignTechnique,
  createDefaultMoveset,
  movesetContextForPosition,
  slotIdFor,
  techniqueForMovesetInput,
  validateMoveset,
} from "@/combat/moveset";

describe("custom movesets", () => {
  it("maps combat positions into contextual button layers", () => {
    expect(movesetContextForPosition("standing_open")).toBe("standing");
    expect(movesetContextForPosition("over_under")).toBe("clinch");
    expect(movesetContextForPosition("standing_over_grounded")).toBe(
      "grounded_opponent"
    );
  });

  it("creates a valid style-legal default moveset", () => {
    const moveset = createDefaultMoveset("adimurai");
    expect(validateMoveset(moveset).valid).toBe(true);
    expect(moveset.slots.standing_a).toBeTruthy();
    expect(moveset.slots.clinch_a).toBeTruthy();
    expect(moveset.slots.grounded_a).toBeTruthy();
  });

  it("resolves the same button differently by combat context", () => {
    const moveset = createDefaultMoveset("adimurai");
    const standing = techniqueForMovesetInput(
      moveset,
      "standing_open",
      "a"
    );
    const clinch = techniqueForMovesetInput(
      moveset,
      "over_under",
      "a"
    );
    expect(standing).toBeTruthy();
    expect(clinch).toBeTruthy();
    expect(standing).not.toBe(clinch);
  });

  it("rejects a technique from another style", () => {
    const moveset = createDefaultMoveset("boxing");
    expect(() =>
      assignTechnique(moveset, "standing_a", "round_kick_head")
    ).toThrow();
  });

  it("rejects assigning grounded offense to a standing slot", () => {
    const moveset = createDefaultMoveset("adimurai");
    expect(() =>
      assignTechnique(moveset, "standing_a", "soccer_kick_head")
    ).toThrow();
  });

  it("allows free replacement with another legal same-context technique", () => {
    const moveset = createDefaultMoveset("adimurai");
    const edited = assignTechnique(moveset, "standing_a", "cross");
    expect(edited.slots.standing_a).toBe("cross");
    expect(validateMoveset(edited).valid).toBe(true);
  });

  it("maps buttons to stable slot ids", () => {
    expect(slotIdFor("standing_open", "x")).toBe("standing_x");
    expect(slotIdFor("thai_plum", "b")).toBe("clinch_b");
    expect(slotIdFor("standing_over_grounded", "y")).toBe("grounded_y");
  });
});
