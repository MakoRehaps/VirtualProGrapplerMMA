import { describe, expect, it } from "vitest";
import { MayQuvMatch } from "@/combat/MayQuvMatch";
import { techniqueById } from "@/data/combatCatalog";
import type { FighterLoadout } from "@/combat/mayQuvTypes";

function fighter(id: string, styleId = "combat_sambo"): FighterLoadout {
  return {
    id,
    name: id,
    styleId,
    stanceId: styleId === "judo" ? "judo_grip_ready" : "sambo_hybrid",
    body: {
      massKg: 77,
      heightM: 1.78,
      reachM: 1.81,
      centerOfMassHeightRatio: 0.56,
    },
  };
}

const sample = {
  relativeVelocityMps: 5.5,
  contactQuality: "clean" as const,
  guard: "none" as const,
};

describe("grapple defense", () => {
  it("sprawl stops a standing takedown and opens a counter window", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const shot = techniqueById("double_leg")!;

    match.grappleDefenseState = (side) =>
      side === "opponent"
        ? { sprawl: true, whizzer: false }
        : { sprawl: false, whizzer: false };

    expect(match.throwTechnique("player", shot, 0, sample)).toBe(true);
    match.step(shot.startupFrames);

    expect(match.lastExchange?.connected).toBe(false);
    expect(match.lastExchange?.missReason).toBe("sprawled");
    expect(match.isCounterWindow("opponent", shot.startupFrames)).toBe(true);
    expect(match.opponent.positionId).toBe("standing_open");
  });

  it("whizzer stops a clinch takedown", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const trip = techniqueById("body_lock_trip")!;

    expect(match.enterClinch("player", "over_under")).toBe(true);

    match.grappleDefenseState = (side) =>
      side === "opponent"
        ? { sprawl: false, whizzer: true }
        : { sprawl: false, whizzer: false };

    expect(match.throwTechnique("player", trip, 0, sample)).toBe(true);
    match.step(trip.startupFrames);

    expect(match.lastExchange?.connected).toBe(false);
    expect(match.lastExchange?.missReason).toBe("whizzered");
    expect(match.opponent.positionId).toBe("over_under");
  });

  it("wrong defensive input does not stop the wrong takedown type", () => {
    const match = new MayQuvMatch(fighter("a"), fighter("b"));
    const shot = techniqueById("double_leg")!;

    match.grappleDefenseState = () => ({
      sprawl: false,
      whizzer: true,
    });

    expect(match.throwTechnique("player", shot, 0, sample)).toBe(true);
    match.step(shot.startupFrames);

    expect(match.lastExchange?.connected).toBe(true);
    expect(match.opponent.positionId).toBe("seated_guard");
  });
});
