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
