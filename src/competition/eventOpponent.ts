import type {
  CompetitionModeId,
  CompetitionStatus,
} from "./CompetitionSession";

const EVENT_STYLE_POOL = [
  "boxing",
  "muay_thai",
  "judo",
  "combat_sambo",
  "karate_kyokushin",
  "taekwondo",
  "sanda",
  "wing_chun",
  "freestyle_wrestling",
  "american_kickboxing",
  "capoeira",
  "catch_wrestling",
] as const;

function indexFor(
  modeId: CompetitionModeId,
  status: CompetitionStatus
): number {
  switch (modeId) {
    case "weekly_qualifier":
      return 0;
    case "weekly_tournament":
      return 1 + status.weeklyTournamentWins;
    case "monthly_qualifier_one":
      return 4;
    case "monthly_qualifier_two":
      return 5;
    case "monthly_grand_tournament":
      return 6 + status.monthlyTournamentWins;
    default:
      return 0;
  }
}

export function eventOpponentStyleId(
  modeId: CompetitionModeId,
  status: CompetitionStatus
): string | null {
  if (
    modeId === "normal_mp" ||
    modeId === "local_vs" ||
    modeId === "practice_coach"
  ) {
    return null;
  }

  return EVENT_STYLE_POOL[
    indexFor(modeId, status) % EVENT_STYLE_POOL.length
  ];
}

export function eventOpponentStylePool(): readonly string[] {
  return EVENT_STYLE_POOL;
}
