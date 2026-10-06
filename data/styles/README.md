# Combat style database

This directory is the gameplay-facing catalog of living, revived, and modern unarmed combat systems used by VirtualProGrapplerMMA.

## Design rules

- A style is a **technical ruleset**, not a fighter.
- `origin` records where the system is historically associated; `regions` records where it is currently relevant.
- `family` can contain multiple classifications.
- Ratings are **gameplay tuning seeds from 0–100**, not statements that one real-world martial art is objectively better than another.
- Weapon-only material is excluded. Mixed systems are represented only by their unarmed component.
- Closely related rulesets can be separate entries when they create meaningfully different gameplay.
- Historical systems with active revival are marked `revival`; recent synthesized systems are marked `modern_hybrid`.

The first pass seeds the major global striking, grappling, wrestling, submission, hybrid, military/self-defense and folk traditions. The database is intended to expand continuously as sources and gameplay implementations are added.


## Current catalog baseline

The current catalog contains **155 styles across 60 recorded origins**, with no duplicate style IDs or duplicate display names.

Coverage currently spans:

- striking systems and ring striking sports
- folk, belt, jacket, oil and Olympic wrestling
- submission grappling and ground-fighting systems
- hybrid combat sports
- traditional martial systems with meaningful unarmed practice
- military combatives and civilian self-defense systems
- active modern revivals where enough of the unarmed method exists to model gameplay
- Pacific/Oceanic, African, Asian, European, Middle Eastern, Central Asian and American traditions

The catalog intentionally distinguishes a **style** from a **school or organization**. A school only receives a separate record when it changes the playable combat model enough to justify different movement, legal techniques, range behavior, takedown/ground priorities, or defensive logic.

## Completeness rule

"Complete" does not mean every historical name ever recorded. For MAY' QUV it means every reasonably identifiable **current-life unarmed fighting system** that can produce a distinct playable ruleset or style profile. Dead weapon systems, purely ceremonial forms, and duplicate lineage names are excluded unless a substantial living revival exists.
