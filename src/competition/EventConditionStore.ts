import { freshCondition, type FighterCondition } from "@/combat/mayQuvTypes";
import { competitionModeById } from "@/data/combatCatalog";

export type EventDamageKey = "none" | "event_chain" | "monthly_chain";

function cloneCondition(c: FighterCondition): FighterCondition {
  return {
    hp: c.hp,
    stamina: c.stamina,
    consciousness: c.consciousness,
    balance: c.balance,
    regions: { ...c.regions },
  };
}

export class EventConditionStore {
  private weekly: FighterCondition | null = null;
  private monthly: FighterCondition | null = null;

  startCondition(modeId: string): FighterCondition {
    const mode = competitionModeById(modeId);
    const persistence = mode?.damage_persistence as EventDamageKey | undefined;

    if (persistence === "event_chain") {
      return cloneCondition(this.weekly ?? freshCondition());
    }
    if (persistence === "monthly_chain") {
      return cloneCondition(this.monthly ?? freshCondition());
    }
    return freshCondition();
  }

  finishFight(modeId: string, condition: FighterCondition): void {
    const mode = competitionModeById(modeId);
    const persistence = mode?.damage_persistence as EventDamageKey | undefined;
    if (persistence === "event_chain") this.weekly = cloneCondition(condition);
    if (persistence === "monthly_chain") this.monthly = cloneCondition(condition);
  }

  resetWeekly(): void {
    this.weekly = null;
  }

  resetMonthly(): void {
    this.monthly = null;
  }

  resetAll(): void {
    this.resetWeekly();
    this.resetMonthly();
  }
}
