# MAY' QUV System Architecture

## Core competitive contract

MAY' QUV is a 1v1, equalized, style-driven combat game.

Every fighter has:
- 100 HP max
- 100 stamina max
- 100 consciousness max
- 100 balance max

There is no player-selectable stat allocation. There is no stat grind. A fighter is defined by physical body geometry/mass, chosen combat style, stance, and the player's execution.

Style determines the legal technique library. All styles, stances and techniques are available from the start.

## Data stack

### Style
`data/styles/styles.json`
Defines origin, family, ranges, gameplay tendencies and default stance.

### Style technique access
`data/styles/style-techniques.json`
Authoritative move access. This is what enforces style identity.

### Stance
`data/stances/stances.json`
Defines lead side, posture, guard, feet, weight distribution, movement bias and readiness.

### Universal technique catalog
`data/combat/techniques.json`
Contains standing strikes, clinch controls, takedowns, throws, ground transitions, escapes, submissions and PRIDE-style grounded offense.

### Positions
`data/combat/positions.json`
Standing, clinch, ground and grounded-opponent states.

### Transitions
`data/combat/transitions.json`
Deterministic links between positions with execution difficulty and stamina cost.

### Body physics
`data/combat/body-physics.json`
Mass/height ranges and formulas for acceleration, inertia, push resistance, impact effective mass and stamina movement cost.

### Events
`data/combat/events.json`
Unified event vocabulary: strike contact, blocked contact, takedown/throw impact, collision, ground strike, soccer kick, stomp, submission pressure, knockdown, KO and finishes.

### Damage
`data/combat/damage-model.json`
100-HP normalization, consciousness/balance/limb condition, target zones, guard absorption and persistence rules.

### Rulesets
`data/game/rulesets.json`
Standard, event and practice rules.

## Runtime combat flow

```
standing_open
  -> standing_close
  -> clinch
  -> throw / takedown / scramble
  -> seated / knocked-down opponent
  -> soccer kick / stomp / grounded knee / disengage
  -> technical stand-up / KO / decision
```

The deterministic fixed timestep, input buffer and seeded RNG inherited from Virtual Pro Grappler should remain the timing foundation.

## Damage and physics

Moves do not carry arbitrary final damage as the authoritative result.

The intended pipeline is:

```
Technique event
  -> effective mass
  -> relative contact velocity
  -> contact quality
  -> target zone
  -> guard/block absorption
  -> HP / consciousness / balance / limb condition
```

Total body weight must never become a simple linear damage multiplier.

## AI

### Coach
`data/ai/coach.json`

The persistent practice coach studies the player's habits and teaches the human player. Practice never changes fighter statistics and never creates persistent damage.

### Bots
`data/ai/bots.json`

Bots use the same health, physics and style access as players. Higher difficulty means better timing, decisions, transitions and adaptation—not hidden bonuses or future-input reading.

## Competition

`data/game/competition.json`

### Normal multiplayer
Fresh condition every match. No persistent damage.

### Weekly
Bot-only qualifier -> weekly tournament.
Damage carries from qualifier through the tournament and resets after the event.

### Monthly
Bot-only Qualifier I -> bot-only Qualifier II -> MAY' QUV Grand Tournament.
Damage persists through the full chain and resets after the event.

Empty human tournament slots may be filled by fair bots.

## Rankings

`data/game/rankings.json`

The competitive season resets monthly. Top 10 is public and archived. Career history remains.

## Progression

`data/game/progression.json`
`data/cosmetics/catalog.json`

Only cosmetic progression is allowed. Tokens and achievements can unlock clothing, wraps, robes, masks, banners, entrances and similar presentation items. Nothing cosmetic modifies combat.

## Input

`data/game/xinput.json`

XInput is the primary combat controller. The same input grammar changes contextually according to stance, range and position rather than creating separate controller maps for every martial art.
