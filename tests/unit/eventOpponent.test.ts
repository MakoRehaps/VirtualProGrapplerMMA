import { describe, expect, it } from "vitest";
import {
  eventOpponentStyleId,
  eventOpponentStylePool,
} from "@/competition/eventOpponent";
import type { CompetitionStatus } from "@/competition/CompetitionSession";

const base: CompetitionStatus = {
  weeklyQualified: false,
  weeklyTournamentWins: 0,
  monthlyQualifierOneWon: false,
  monthlyQualifierTwoWon: false,
  monthlyTournamentWins: 0,
};

describe("event opponent rotation", () => {
  it("does not override manual-opponent modes", () => {
    expect(eventOpponentStyleId("practice_coach", base)).toBeNull();
    expect(eventOpponentStyleId("local_vs", base)).toBeNull();
    expect(eventOpponentStyleId("normal_mp", base)).toBeNull();
  });

  it("changes weekly opponent style by round", () => {
    const qualifier = eventOpponentStyleId("weekly_qualifier", base);
    const roundOne = eventOpponentStyleId("weekly_tournament", base);
    const roundTwo = eventOpponentStyleId("weekly_tournament", {
      ...base,
      weeklyTournamentWins: 1,
    });

    expect(qualifier).not.toBe(roundOne);
    expect(roundOne).not.toBe(roundTwo);
  });

  it("changes Grand Tournament style by round", () => {
    const styles = new Set(
      [0, 1, 2, 3].map((wins) =>
        eventOpponentStyleId("monthly_grand_tournament", {
          ...base,
          monthlyQualifierOneWon: true,
          monthlyQualifierTwoWon: true,
          monthlyTournamentWins: wins,
        })
      )
    );

    expect(styles.size).toBe(4);
  });

  it("uses only configured style ids", () => {
    expect(eventOpponentStylePool().length).toBeGreaterThanOrEqual(8);
    expect(eventOpponentStylePool()).toContain("wing_chun");
    expect(eventOpponentStylePool()).toContain("sanda");
  });
});
