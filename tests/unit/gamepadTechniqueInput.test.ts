import { describe, expect, it } from "vitest";
import { GamepadTechniqueInput } from "@/game/GamepadTechniqueInput";

function fakePad(buttons: boolean[]): Gamepad {
  return {
    id: "Xbox Controller",
    index: 0,
    connected: true,
    mapping: "standard",
    timestamp: 1,
    axes: [0, 0, 0, 0],
    buttons: buttons.map((pressed) => ({
      pressed,
      touched: pressed,
      value: pressed ? 1 : 0,
    })),
    vibrationActuator: undefined as never,
    hapticActuators: [],
  } as unknown as Gamepad;
}

describe("GamepadTechniqueInput", () => {
  it("emits face buttons only on the press edge", () => {
    let pad = fakePad([false, false, false, false, false, false]);
    const input = new GamepadTechniqueInput(() => [pad]);

    expect(input.update().buttons).toEqual([]);

    pad = fakePad([true, false, false, false, false, false]);
    expect(input.update().buttons).toEqual(["a"]);
    expect(input.update().buttons).toEqual([]);

    pad = fakePad([false, false, false, false, false, false]);
    input.update();

    pad = fakePad([true, false, true, false, false, false]);
    expect(input.update().buttons).toEqual(["a", "x"]);
  });

  it("emits RB as a clinch toggle edge", () => {
    let pad = fakePad([false, false, false, false, false, false]);
    const input = new GamepadTechniqueInput(() => [pad]);

    expect(input.update().clinchToggle).toBe(false);

    pad = fakePad([false, false, false, false, false, true]);
    expect(input.update().clinchToggle).toBe(true);
    expect(input.update().clinchToggle).toBe(false);
  });
});
