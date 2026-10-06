import type { MovesetButton } from "@/combat/moveset";

export interface GamepadTechniqueFrame {
  buttons: MovesetButton[];
  clinchToggle: boolean;
}

export type GamepadProvider = () => readonly (Gamepad | null)[];

const DEFAULT_PROVIDER: GamepadProvider = () => {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  return Array.from(navigator.getGamepads());
};

const BUTTON_INDEX: Record<MovesetButton, number> = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
};

export class GamepadTechniqueInput {
  private readonly previous = new Map<number, boolean>();
  private previousRb = false;

  constructor(private readonly provider: GamepadProvider = DEFAULT_PROVIDER) {}

  private primary(): Gamepad | null {
    const pads = this.provider();
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      if (pad.mapping === "standard" || /xbox|xinput/i.test(pad.id)) {
        return pad;
      }
    }
    return pads.find((p): p is Gamepad => Boolean(p?.connected)) ?? null;
  }

  update(): GamepadTechniqueFrame {
    const pad = this.primary();
    if (!pad) {
      this.previous.clear();
      this.previousRb = false;
      return { buttons: [], clinchToggle: false };
    }

    const buttons: MovesetButton[] = [];

    for (const button of Object.keys(BUTTON_INDEX) as MovesetButton[]) {
      const index = BUTTON_INDEX[button];
      const down = Boolean(pad.buttons[index]?.pressed);
      const wasDown = this.previous.get(index) ?? false;
      if (down && !wasDown) buttons.push(button);
      this.previous.set(index, down);
    }

    // Standard Gamepad mapping: RB = button 5.
    const rbDown = Boolean(pad.buttons[5]?.pressed);
    const clinchToggle = rbDown && !this.previousRb;
    this.previousRb = rbDown;

    return { buttons, clinchToggle };
  }
}
