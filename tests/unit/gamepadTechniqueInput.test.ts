import { describe, expect, it } from "vitest";
import {
  GamepadTechniqueInput,
  gamepadSlotConnected,
} from "@/game/GamepadTechniqueInput";

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
  it("reports exact controller-slot availability", () => {
    const p1 = fakePad([false, false, false, false, false, false]);
    const p2 = {
      ...fakePad([false, false, false, false, false, false]),
      index: 1,
      id: "Xbox Controller P2",
    } as Gamepad;

    expect(gamepadSlotConnected(0, () => [p1, p2])).toBe(true);
    expect(gamepadSlotConnected(1, () => [p1, p2])).toBe(true);
    expect(gamepadSlotConnected(1, () => [p1, null])).toBe(false);
  });

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

  it("keeps player two isolated to gamepad slot one", () => {
    const p1 = fakePad([true, false, false, false, false, false]);
    const p2 = {
      ...fakePad([false, true, false, false, false, false]),
      index: 1,
      id: "Xbox Controller P2",
    } as Gamepad;

    const input = new GamepadTechniqueInput(() => [p1, p2], 1);
    expect(input.update().buttons).toEqual(["b"]);
  });

  it("does not let a missing P2 pad fall back to P1", () => {
    const p1 = fakePad([true, false, false, false, false, false]);
    const input = new GamepadTechniqueInput(() => [p1, null], 1);
    expect(input.update().buttons).toEqual([]);
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
