# AGENTS.md — MAY' QUV

## Project identity

MAY' QUV is a 1v1 international Kumite combat game built on the Virtual Pro Grappler engine.

Combat reference philosophy:
- UFC Undisputed 3-style contextual control depth and positional grappling.
- PRIDE-style fight possibilities and aggressive grounded offense.
- Kumite presentation: square platform / underground international tournament atmosphere.
- Deterministic simulation for future online ranked play.

## Non-negotiable competitive rules

- 1v1 only for the core competitive game.
- XInput is the primary gameplay input.
- Every fighter has exactly 100 max HP.
- Competitive capability is equalized. There is no selectable Strength/Chin/Speed/etc. stat allocation.
- Numeric power stats are hidden simulation details, not player progression.
- Style determines technique access.
- Body mass, height, reach, stance, momentum and geometry affect physics.
- The player determines outcomes through timing, positioning, reads, stamina management and technique choice.
- No gameplay move/style/stance unlock grind. All are available immediately.
- Fighter rebuild/reroll is free.
- Cosmetics/tokens may be earned, but cosmetics never alter combat power.
- Practice never grants stat buffs.
- No conventional automatic TKO system.
- Core finishes: KO, submission, decision, forfeit. Special stoppages require explicit design approval.

## Combat architecture

Build new MAY' QUV systems beside legacy wrestling systems until replacement is complete.

Authoritative new data:
- data/styles/styles.json
- data/styles/style-techniques.json
- data/stances/stances.json
- data/combat/techniques.json
- data/combat/positions.json
- data/combat/transitions.json
- data/combat/body-physics.json
- data/combat/events.json
- data/combat/damage-model.json
- data/game/rulesets.json

Combat state flow:
standing -> clinch -> takedown transition -> ground position -> submission / ground striking / stand-up / KO.

Grounded PRIDE/Kumite offense may include soccer kicks, stomps and knees to the head when the active ruleset permits them.

Damage comes through deterministic combat events. Do not hardcode unrelated damage systems per move.

## Physics

Use:
FighterBody + Stance + Style + CurrentCondition = actual physical behavior.

Mass influences inertia, acceleration, push resistance and effective impact mass, but must not become a direct linear damage multiplier.

HP max remains 100 regardless of weight.

## Practice coach

Practice uses one persistent coach/sparring NPC generated alongside the player's fighter.
The coach:
- observes player habits;
- teaches one problem at a time before combining problems;
- can choose counter styles/stances/technique packages;
- never reads future inputs;
- never receives hidden health/damage bonuses;
- never changes player stats;
- never creates persistent damage;
- gives qualitative teaching feedback instead of exposing hidden power ratings.

## Multiplayer / events

Normal multiplayer:
- 1v1 human vs human.
- Fresh condition each fight.
- No persistent damage.

Weekly event:
- bot-only qualifier.
- qualifier damage carries into that weekly tournament.
- tournament can fill empty human bracket slots with fair bots.
- damage resets when the event ends.

Monthly MAY' QUV:
- bot-only Qualifier I.
- bot-only Qualifier II.
- both must be won.
- damage carries through both qualifiers and the Grand Tournament.
- empty tournament slots may be filled with fair bots.
- event damage resets after the monthly event.

Rank/rating resets monthly. Career history, archived Top 10s, titles, cosmetics and tokens persist.

## Ranking and progression

- Public Top 10 leaderboard.
- #1 is the MAY' QUV Champion.
- Use rating quality, not raw win farming.
- Repeated-opponent boosting should have diminishing value.
- Bot qualifier matches do not affect rank.
- Practice does not affect rank.
- Progression unlocks cosmetics only.

## Validation

Run:
npm run validate:data

Do not bypass validation when adding styles, stances, techniques, positions, transitions, competition modes or cosmetics.
