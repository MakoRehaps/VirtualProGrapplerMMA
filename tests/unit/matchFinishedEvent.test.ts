import { describe, expect, it } from "vitest";
import { MayQuvMatch } from "@/combat/MayQuvMatch";
import type { FighterLoadout } from "@/combat/mayQuvTypes";

function fighter(id: string): FighterLoadout {
  return {
    id,
    name: id,
    styleId: "boxing",
    stanceId: "boxing_orthodox",
    body: {
      massKg: 77,
      heightM: 1.78,
      reachM: 1.81,
      centerOfMassHeightRatio: 0.56,
    },
  };
}

describe("match finished event", () => {
  it("emits decision draw completion", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const events: Array<[string, string | null]> = [];
    match.onFinished = (finish, winner) => events.push([finish, winner]);

    match.step((600 + 300) * 60);

    expect(events).toEqual([["decision", null]]);
  });

  it("emits forfeit completion once", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const events: Array<[string, string | null]> = [];
    match.onFinished = (finish, winner) => events.push([finish, winner]);

    expect(match.forfeit("player")).toBe(true);
    expect(match.forfeit("player")).toBe(false);

    expect(events).toEqual([["forfeit", "opponent"]]);
  });
});
