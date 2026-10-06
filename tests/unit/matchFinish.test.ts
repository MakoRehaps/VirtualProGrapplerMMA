import { describe, expect, it } from "vitest";
import { MayQuvMatch } from "@/combat/MayQuvMatch";
import { techniqueById } from "@/data/combatCatalog";
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

const sample = {
  relativeVelocityMps: 6.2,
  contactQuality: "clean" as const,
  guard: "none" as const,
};

describe("MAY' QUV fight finishes", () => {
  it("uses the configured 10 + 5 minute fight clock", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const before = match.snapshot();

    expect(before.timeLimitFrames).toBe((600 + 300) * 60);

    match.step(before.timeLimitFrames! - 1);
    expect(match.finish).toBeNull();

    match.step(before.timeLimitFrames!);
    expect(match.finish).toBe("decision");
  });

  it("awards a whole-fight decision to the fighter who did effective damage", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const cross = techniqueById("cross")!;

    match.throwTechnique("player", cross, 0, sample);
    match.step(cross.startupFrames);
    match.step((600 + 300) * 60);

    expect(match.finish).toBe("decision");
    expect(match.winner).toBe("player");
    expect(match.snapshot().decision?.player).toBeGreaterThan(
      match.snapshot().decision?.opponent ?? 0
    );
  });

  it("permits a decision draw when the fight is truly even", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));

    match.step((600 + 300) * 60);

    expect(match.finish).toBe("decision");
    expect(match.winner).toBeNull();
    expect(match.snapshot().decision?.margin).toBe(0);
  });

  it("forfeit immediately awards the other fighter the fight", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));

    expect(match.forfeit("player")).toBe(true);
    expect(match.finish).toBe("forfeit");
    expect(match.winner).toBe("opponent");
    expect(match.forfeit("opponent")).toBe(false);
  });

  it("cannot schedule new techniques after a decision draw", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const cross = techniqueById("cross")!;

    match.step((600 + 300) * 60);
    expect(match.throwTechnique("player", cross, match.snapshot().elapsedFrames, sample)).toBe(false);
  });
});
