import type { FighterCondition } from "@/combat/mayQuvTypes";
import { EventConditionStore } from "./EventConditionStore";

export type CompetitionModeId =
  | "normal_mp"
  | "local_vs"
  | "practice_coach"
  | "weekly_qualifier"
  | "weekly_tournament"
  | "monthly_qualifier_one"
  | "monthly_qualifier_two"
  | "monthly_grand_tournament";

export interface CompetitionStatus {
  weeklyQualified: boolean;
  monthlyQualifierOneWon: boolean;
  monthlyQualifierTwoWon: boolean;
}

const ROUTE_TO_MODE: Record<string, CompetitionModeId> = {
  "match_setup.exhibition": "normal_mp",
  "match_setup.royal_rumble": "weekly_qualifier",
  "match_setup.pay_per_view": "weekly_tournament",
  "match_setup.king_of_the_ring": "monthly_qualifier_one",
  "match_setup.guest_referee": "monthly_qualifier_two",
  "match_setup.ladder_match": "monthly_grand_tournament",
  "match_setup.ironman_match": "local_vs",
  "single_play.championship": "practice_coach",
  "single_play.survival": "practice_coach",
  "test.combat_system": "practice_coach",
};

export function modeForRoute(routeId: string): CompetitionModeId {
  return ROUTE_TO_MODE[routeId] ?? "practice_coach";
}

export class CompetitionSession {
  private readonly conditions = new EventConditionStore();
  private status: CompetitionStatus = {
    weeklyQualified: false,
    monthlyQualifierOneWon: false,
    monthlyQualifierTwoWon: false,
  };

  snapshot(): CompetitionStatus {
    return { ...this.status };
  }

  canEnter(modeId: CompetitionModeId): boolean {
    if (modeId === "weekly_tournament") {
      return this.status.weeklyQualified;
    }
    if (modeId === "monthly_qualifier_two") {
      return this.status.monthlyQualifierOneWon;
    }
    if (modeId === "monthly_grand_tournament") {
      return (
        this.status.monthlyQualifierOneWon &&
        this.status.monthlyQualifierTwoWon
      );
    }
    return true;
  }

  startCondition(modeId: CompetitionModeId): FighterCondition {
    return this.conditions.startCondition(modeId);
  }

  recordFight(
    modeId: CompetitionModeId,
    won: boolean,
    condition: FighterCondition
  ): void {
    this.conditions.finishFight(modeId, condition);

    if (modeId === "weekly_qualifier") {
      this.status.weeklyQualified = won;
      if (!won) this.conditions.resetWeekly();
      return;
    }

    if (modeId === "weekly_tournament") {
      this.status.weeklyQualified = false;
      this.conditions.resetWeekly();
      return;
    }

    if (modeId === "monthly_qualifier_one") {
      this.status.monthlyQualifierOneWon = won;
      this.status.monthlyQualifierTwoWon = false;
      if (!won) this.conditions.resetMonthly();
      return;
    }

    if (modeId === "monthly_qualifier_two") {
      this.status.monthlyQualifierTwoWon = won;
      if (!won) {
        this.status.monthlyQualifierOneWon = false;
        this.conditions.resetMonthly();
      }
      return;
    }

    if (modeId === "monthly_grand_tournament") {
      this.status.monthlyQualifierOneWon = false;
      this.status.monthlyQualifierTwoWon = false;
      this.conditions.resetMonthly();
    }
  }

  resetAll(): void {
    this.status = {
      weeklyQualified: false,
      monthlyQualifierOneWon: false,
      monthlyQualifierTwoWon: false,
    };
    this.conditions.resetAll();
  }
}

export const COMPETITION_SESSION = new CompetitionSession();
