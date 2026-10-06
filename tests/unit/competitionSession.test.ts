import { describe, expect, it } from "vitest";
import {
  CompetitionSession,
  modeForRoute,
} from "@/competition/CompetitionSession";
import { freshCondition } from "@/combat/mayQuvTypes";

describe("competition session", () => {
  it("maps implemented menu routes to competition modes", () => {
    expect(modeForRoute("match_setup.royal_rumble")).toBe(
      "weekly_qualifier"
    );
    expect(modeForRoute("match_setup.ladder_match")).toBe(
      "monthly_grand_tournament"
    );
  });

  it("requires weekly qualifier victory before weekly tournament", () => {
    const session = new CompetitionSession();
    expect(session.canEnter("weekly_tournament")).toBe(false);

    session.recordFight(
      "weekly_qualifier",
      true,
      freshCondition()
    );

    expect(session.canEnter("weekly_tournament")).toBe(true);
  });

  it("requires both monthly qualifiers in order", () => {
    const session = new CompetitionSession();

    expect(session.canEnter("monthly_qualifier_two")).toBe(false);
    expect(session.canEnter("monthly_grand_tournament")).toBe(false);

    session.recordFight(
      "monthly_qualifier_one",
      true,
      freshCondition()
    );

    expect(session.canEnter("monthly_qualifier_two")).toBe(true);
    expect(session.canEnter("monthly_grand_tournament")).toBe(false);

    session.recordFight(
      "monthly_qualifier_two",
      true,
      freshCondition()
    );

    expect(session.canEnter("monthly_grand_tournament")).toBe(true);
  });

  it("carries weekly damage from qualifier into weekly event", () => {
    const session = new CompetitionSession();
    const condition = freshCondition();
    condition.hp = 72;
    condition.regions.leftLeg = 48;

    session.recordFight("weekly_qualifier", true, condition);
    const carried = session.startCondition("weekly_tournament");

    expect(carried.hp).toBe(72);
    expect(carried.regions.leftLeg).toBe(48);
  });

  it("keeps weekly qualification and damage through early bracket rounds", () => {
    const session = new CompetitionSession();
    const condition = freshCondition();
    condition.hp = 65;

    session.recordFight("weekly_qualifier", true, condition);
    session.recordFight("weekly_tournament", true, condition);

    expect(session.canEnter("weekly_tournament")).toBe(true);
    expect(session.snapshot().weeklyTournamentWins).toBe(1);
    expect(session.startCondition("weekly_tournament").hp).toBe(65);
  });

  it("resets weekly damage only after winning all three bracket rounds", () => {
    const session = new CompetitionSession();
    const condition = freshCondition();
    condition.hp = 65;

    session.recordFight("weekly_qualifier", true, condition);
    for (let i = 0; i < session.weeklyRoundsRequired; i += 1) {
      session.recordFight("weekly_tournament", true, condition);
    }

    expect(session.weeklyRoundsRequired).toBe(3);
    expect(session.startCondition("weekly_qualifier").hp).toBe(100);
    expect(session.canEnter("weekly_tournament")).toBe(false);
    expect(session.snapshot().weeklyTournamentWins).toBe(0);
  });

  it("elimination resets the weekly bracket immediately", () => {
    const session = new CompetitionSession();
    const condition = freshCondition();
    condition.hp = 71;

    session.recordFight("weekly_qualifier", true, condition);
    session.recordFight("weekly_tournament", true, condition);
    session.recordFight("weekly_tournament", false, condition);

    expect(session.canEnter("weekly_tournament")).toBe(false);
    expect(session.snapshot().weeklyTournamentWins).toBe(0);
    expect(session.startCondition("weekly_qualifier").hp).toBe(100);
  });

  it("requires four Grand Tournament wins before monthly reset", () => {
    const session = new CompetitionSession();
    const condition = freshCondition();
    condition.hp = 68;

    session.recordFight("monthly_qualifier_one", true, condition);
    session.recordFight("monthly_qualifier_two", true, condition);

    for (let i = 0; i < session.monthlyRoundsRequired - 1; i += 1) {
      session.recordFight("monthly_grand_tournament", true, condition);
      expect(session.canEnter("monthly_grand_tournament")).toBe(true);
    }

    expect(session.monthlyRoundsRequired).toBe(4);
    expect(session.snapshot().monthlyTournamentWins).toBe(3);
    expect(session.startCondition("monthly_grand_tournament").hp).toBe(68);

    session.recordFight("monthly_grand_tournament", true, condition);
    expect(session.canEnter("monthly_grand_tournament")).toBe(false);
    expect(session.snapshot().monthlyTournamentWins).toBe(0);
    expect(session.startCondition("monthly_qualifier_one").hp).toBe(100);
  });

  it("losing monthly qualifier two resets the monthly chain", () => {
    const session = new CompetitionSession();
    const condition = freshCondition();
    condition.hp = 70;

    session.recordFight("monthly_qualifier_one", true, condition);
    session.recordFight("monthly_qualifier_two", false, condition);

    const status = session.snapshot();
    expect(status.monthlyQualifierOneWon).toBe(false);
    expect(status.monthlyQualifierTwoWon).toBe(false);
    expect(session.startCondition("monthly_qualifier_one").hp).toBe(100);
  });
});
