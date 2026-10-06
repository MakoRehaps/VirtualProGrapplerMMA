import type { CombatSide } from "./mayQuvTypes";

export interface JudgingStats {
  effectiveDamage: number;
  consciousnessDamage: number;
  regionalDamage: number;
  knockdowns: number;
  connectedOffense: number;
  defendedOffense: number;
}

export interface JudgingScore {
  player: number;
  opponent: number;
  winner: CombatSide | null;
  margin: number;
}

export function freshJudgingStats(): Record<CombatSide, JudgingStats> {
  const empty = (): JudgingStats => ({
    effectiveDamage: 0,
    consciousnessDamage: 0,
    regionalDamage: 0,
    knockdowns: 0,
    connectedOffense: 0,
    defendedOffense: 0,
  });
  return { player: empty(), opponent: empty() };
}

/**
 * Whole-fight judging: damage/danger dominates, then knockdowns and effective
 * offense. This deliberately does not reward empty movement or hidden stats.
 */
export function scoreWholeFight(
  stats: Record<CombatSide, JudgingStats>
): JudgingScore {
  const score = (s: JudgingStats) =>
    s.effectiveDamage * 1.0 +
    s.consciousnessDamage * 1.35 +
    s.regionalDamage * 0.2 +
    s.knockdowns * 12 +
    s.connectedOffense * 0.35 +
    s.defendedOffense * 0.08;

  const player = Math.round(score(stats.player) * 100) / 100;
  const opponent = Math.round(score(stats.opponent) * 100) / 100;
  const margin = Math.round(Math.abs(player - opponent) * 100) / 100;

  return {
    player,
    opponent,
    winner:
      Math.abs(player - opponent) < 0.01
        ? null
        : player > opponent
          ? "player"
          : "opponent",
    margin,
  };
}
