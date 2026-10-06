<template>
  <div class="game">
    <canvas ref="canvas" class="game__canvas" />

    <!-- Character selection overlay, shown until a character is chosen. -->
    <div v-if="!started" class="overlay">
      <h1 class="overlay__title">Choose your character</h1>

      <div class="fighter-setup">
        <label>
          Fighter name
          <input v-model.trim="fighterName" maxlength="24" />
        </label>

        <label>
          Player style
          <select v-model="fighterStyle">
            <option
              v-for="style in styles"
              :key="style.style_id"
              :value="style.style_id"
            >
              {{ style.name }}
            </option>
          </select>
        </label>

        <label>
          Opponent style
          <select v-model="opponentStyle">
            <option
              v-for="style in styles"
              :key="`opponent-${style.style_id}`"
              :value="style.style_id"
            >
              {{ style.name }}
            </option>
          </select>
        </label>

        <label>
          Bot difficulty
          <select v-model="botDifficulty">
            <option value="learner">Learner</option>
            <option value="club">Club</option>
            <option value="competitive">Competitive</option>
            <option value="elite">Elite</option>
            <option value="master">Master</option>
          </select>
        </label>

        <label>
          Height
          <input
            v-model.number="fighterHeight"
            type="range"
            :min="bodyBounds.min_height_m"
            :max="bodyBounds.max_height_m"
            step="0.01"
          />
          <span>{{ fighterHeight.toFixed(2) }} m</span>
        </label>

        <label>
          Weight
          <input
            v-model.number="fighterMass"
            type="range"
            :min="bodyBounds.min_mass_kg"
            :max="bodyBounds.max_mass_kg"
            step="1"
          />
          <span>{{ fighterMass.toFixed(0) }} kg</span>
        </label>

        <label>
          Reach
          <input
            v-model.number="fighterReach"
            type="range"
            :min="reachMin"
            :max="reachMax"
            step="0.01"
          />
          <span>{{ fighterReach.toFixed(2) }} m</span>
        </label>

        <p>
          No weight classes. Body size changes continuous physics only;
          HP stays 100.
        </p>
      </div>

      <div class="roster">
        <button
          v-for="character in characters"
          :key="character.id"
          class="roster__card"
          :class="{ 'roster__card--busy': loadingId !== null }"
          :disabled="loadingId !== null"
          @click="choose(character)"
        >
          <span
            class="roster__swatch"
            :style="{ background: character.swatch }"
          />
          <span class="roster__name">{{ character.label }}</span>
          <span class="roster__tone">{{ character.tone }}</span>
          <span v-if="loadingId === character.id" class="roster__loading">
            Loading&hellip;
          </span>
        </button>
      </div>

      <div v-if="fighterPresets.length" class="saved-fighters">
        <strong>Saved fighters</strong>
        <div
          v-for="preset in fighterPresets"
          :key="preset.name"
          class="saved-fighters__row"
        >
          <button @click="loadFighterPreset(preset)">
            <strong>{{ preset.name }}</strong>
            <span>
              {{ preset.setup.styleId }}
              · {{ preset.setup.body.heightM.toFixed(2) }} m
              · {{ preset.setup.body.massKg.toFixed(0) }} kg
              · moveset {{ preset.movesetName ?? 'Default' }}
            </span>
          </button>
          <button @click="removeFighterPreset(preset.name)">Delete</button>
        </div>
      </div>

      <p v-if="error" class="overlay__error">{{ error }}</p>

      <button class="overlay__back" @click="$emit('exit')">
        Back to Main Menu
      </button>
    </div>

    <CombatDebug
      v-if="started && game"
      :source="() => game?.matchSnapshot() ?? null"
      :frame-source="() => game?.simFrame ?? 0"
      :moveset-source="() => game?.movesetSnapshot() ?? null"
    />

    <MovesetEditor
      v-if="started && game && movesetOpen && game.currentPlayerMoveset"
      :moveset="game.currentPlayerMoveset"
      @apply="applyMoveset"
      @close="movesetOpen = false"
    />

    <div v-if="started && matchResult" class="result">
      <div class="result__panel">
        <h2>{{ resultTitle }}</h2>
        <p>{{ resultDetail }}</p>
        <p v-if="matchResult.decision">
          Score: Player {{ matchResult.decision.player }}
          · Opponent {{ matchResult.decision.opponent }}
        </p>
        <div class="result__actions">
          <button
            v-if="nextEventRoute"
            @click="$emit('navigate', nextEventRoute)"
          >
            {{ nextEventLabel }}
          </button>
          <button @click="rematch">Rematch</button>
          <button @click="reset">Change fighter</button>
          <button @click="$emit('exit')">Main menu</button>
        </div>
      </div>
    </div>

    <!-- Controls legend, shown once playing. -->
    <div v-if="started" class="hud">
      <div class="hud__keys">
        <span><kbd>LS</kbd> Move</span>
        <span><kbd>LT</kbd> Guard</span>
        <span><kbd>RS</kbd> Slip / Duck / Lean</span>
        <span><kbd>LB</kbd>+<kbd>RS</kbd> Sprawl / Whizzer</span>
        <span><kbd>A</kbd><kbd>B</kbd><kbd>X</kbd><kbd>Y</kbd> Moveset</span>
        <span><kbd>RB</kbd> Clinch / Stand</span>
        <span>Keyboard fallback: WASD · J/K · P</span>
      </div>
      <button class="hud__change" @click="movesetOpen = true">Edit Moveset</button>
      <button class="hud__change" @click="saveCurrentFighter">Save Fighter</button>
      <button
        v-if="!matchResult"
        class="hud__change"
        @click="forfeitMatch"
      >
        Forfeit
      </button>
      <button class="hud__change" @click="reset">Change character</button>
      <button class="hud__change" @click="$emit('exit')">Main menu</button>
      <p class="hud__hint">
        A/B/X/Y change automatically between standing, clinch and grounded-opponent
        contexts. RB enters/exits clinch and performs technical stand-up when down.
      </p>
      <p v-if="warning" class="hud__warning">{{ warning }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, markRaw } from "vue";
import { GameScene } from "@/renderer/GameScene";
import { CHARACTERS, CharacterDefinition } from "@/game/config";
import CombatDebug from "./CombatDebug.vue";
import MovesetEditor from "./MovesetEditor.vue";
import type { FighterMoveset } from "@/combat/moveset";
import { loadMoveset } from "@/combat/movesetStore";
import type { FighterLoadout } from "@/combat/mayQuvTypes";
import type { BotDifficultyId } from "@/ai/BotBrain";
import { BODY_PHYSICS, STYLES, styleById } from "@/data/combatCatalog";
import {
  COMPETITION_SESSION,
  modeForRoute,
  type CompetitionModeId,
} from "@/competition/CompetitionSession";
import {
  deleteFighterPreset,
  listFighterPresets,
  saveFighterPreset,
  type FighterPreset,
} from "@/game/fighterPresetStore";

export default defineComponent({
  name: "Game",

  components: { CombatDebug, MovesetEditor },

  props: {
    launchRoute: {
      type: String,
      default: "test.combat_system",
    },
  },

  emits: ["exit", "navigate"],

  data() {
    return {
      characters: CHARACTERS,
      styles: STYLES,
      bodyBounds: BODY_PHYSICS.legal_body_envelope,
      fighterName: "Fighter",
      fighterStyle: "boxing",
      opponentStyle: "combat_sambo",
      botDifficulty: "club" as BotDifficultyId,
      selectedBotDifficulty: "club" as BotDifficultyId,
      fighterPresets: [] as FighterPreset[],
      fighterHeight: BODY_PHYSICS.reference_body.height_m,
      fighterMass: BODY_PHYSICS.reference_body.mass_kg,
      fighterReach: BODY_PHYSICS.reference_body.reach_m,
      started: false,
      loadingId: null as string | null,
      error: "" as string,
      warning: "" as string,
      movesetOpen: false,
      selectedCharacter: null as CharacterDefinition | null,
      selectedSetup: null as
        | (Pick<FighterLoadout, "styleId" | "stanceId" | "body"> & {
            name?: string;
          })
        | null,
      selectedOpponentSetup: null as
        | (Pick<FighterLoadout, "styleId" | "stanceId" | "body"> & {
            name?: string;
          })
        | null,
      matchResult: null as ReturnType<GameScene["matchSnapshot"]>,
      resultTimer: 0,
      // markRaw keeps Vue from proxying the whole Babylon scene graph, which
      // would be both slow and subtly break engine internals.
      game: null as GameScene | null,
    };
  },

  mounted() {
    const canvas = this.$refs.canvas as HTMLCanvasElement;
    this.game = markRaw(new GameScene(canvas));
    this.refreshFighterPresets();
  },

  beforeUnmount() {
    window.clearInterval(this.resultTimer);
    this.game?.dispose();
    this.game = null;
  },

  computed: {
    competitionMode(): CompetitionModeId {
      return modeForRoute(this.launchRoute);
    },

    reachMin(): number {
      return Math.round(
        this.fighterHeight *
          this.bodyBounds.min_reach_to_height_ratio *
          100
      ) / 100;
    },

    reachMax(): number {
      return Math.round(
        this.fighterHeight *
          this.bodyBounds.max_reach_to_height_ratio *
          100
      ) / 100;
    },

    nextEventRoute(): string | null {
      if (!this.matchResult || this.matchResult.winner !== "player") {
        return null;
      }

      if (this.competitionMode === "weekly_qualifier") {
        return "match_setup.pay_per_view";
      }
      if (this.competitionMode === "monthly_qualifier_one") {
        return "match_setup.guest_referee";
      }
      if (this.competitionMode === "monthly_qualifier_two") {
        return "match_setup.ladder_match";
      }
      return null;
    },

    nextEventLabel(): string {
      if (this.competitionMode === "weekly_qualifier") {
        return "Continue to Weekly Kumite";
      }
      if (this.competitionMode === "monthly_qualifier_one") {
        return "Continue to Monthly Qualifier II";
      }
      if (this.competitionMode === "monthly_qualifier_two") {
        return "Continue to Grand Tournament";
      }
      return "";
    },

    resultTitle(): string {
      if (!this.matchResult) return "";
      if (!this.matchResult.winner) return "Draw";
      return this.matchResult.winner === "player"
        ? "Victory"
        : "Defeat";
    },

    resultDetail(): string {
      if (!this.matchResult?.finish) return "";
      if (this.matchResult.finish === "ko") return "Knockout";
      if (this.matchResult.finish === "decision") return "Decision";
      if (this.matchResult.finish === "forfeit") return "Forfeit";
      return this.matchResult.finish;
    },
  },

  methods: {
    refreshFighterPresets() {
      this.fighterPresets = listFighterPresets();
    },

    async loadFighterPreset(preset: FighterPreset) {
      const character = this.characters.find(
        (x) => x.id === preset.characterId
      );
      if (!character) {
        this.error = `Missing character model for preset ${preset.name}`;
        return;
      }

      this.fighterName = preset.setup.name ?? preset.name;
      this.fighterStyle = preset.setup.styleId;
      this.fighterHeight = preset.setup.body.heightM;
      this.fighterMass = preset.setup.body.massKg;
      this.fighterReach = preset.setup.body.reachM;
      await this.choose(character);
      if (preset.movesetName && this.game) {
        const moveset = loadMoveset(
          preset.setup.styleId,
          preset.movesetName
        );
        if (moveset) this.game.setPlayerMoveset(moveset);
      }
    },

    removeFighterPreset(name: string) {
      deleteFighterPreset(name);
      this.refreshFighterPresets();
    },

    saveCurrentFighter() {
      if (!this.selectedCharacter || !this.selectedSetup) {
        this.warning = "Start a fighter once before saving this build.";
        return;
      }

      saveFighterPreset({
        version: 1,
        name: this.selectedSetup.name?.trim() || this.fighterName || "Fighter",
        characterId: this.selectedCharacter.id,
        movesetName: this.game?.currentPlayerMoveset?.name,
        setup: {
          ...this.selectedSetup,
          body: { ...this.selectedSetup.body },
        },
      });
      this.refreshFighterPresets();
      this.warning = "Fighter build saved.";
    },

    async choose(character: CharacterDefinition) {
      if (this.loadingId) return;
      this.loadingId = character.id;
      this.error = "";
      this.warning = "";

      try {
        if (!COMPETITION_SESSION.canEnter(this.competitionMode)) {
          this.error =
            this.competitionMode === "weekly_tournament"
              ? "Win the Weekly Qualifier first."
              : this.competitionMode === "monthly_qualifier_two"
                ? "Win Monthly Qualifier I first."
                : "Win both Monthly Qualifiers first.";
          return;
        }

        const style = styleById(this.fighterStyle);
        const setup = {
          name: this.fighterName || "Fighter",
          styleId: this.fighterStyle,
          stanceId: style?.default_stance ?? "neutral_fighting",
          body: {
            massKg: this.fighterMass,
            heightM: this.fighterHeight,
            reachM: this.fighterReach,
            centerOfMassHeightRatio: 0.56,
          },
        };
        const opponentStyle = styleById(this.opponentStyle);
        const opponentSetup = {
          name: "Opponent",
          styleId: this.opponentStyle,
          stanceId:
            opponentStyle?.default_stance ?? "neutral_fighting",
          body: {
            massKg: 82,
            heightM: 1.82,
            reachM: 1.86,
            centerOfMassHeightRatio: 0.56,
          },
        };
        const startingCondition =
          COMPETITION_SESSION.startCondition(this.competitionMode);
        const missing = await this.game!.loadCharacter(
          character,
          setup,
          opponentSetup,
          this.botDifficulty,
          startingCondition
        );
        if (missing.length) {
          this.warning = `Missing animation clips: ${missing.join(", ")}`;
        }
        this.selectedCharacter = character;
        this.selectedSetup = {
          ...setup,
          body: { ...setup.body },
        };
        this.selectedOpponentSetup = {
          ...opponentSetup,
          body: { ...opponentSetup.body },
        };
        this.selectedBotDifficulty = this.botDifficulty;
        this.started = true;
        this.matchResult = null;
        window.clearInterval(this.resultTimer);
        this.resultTimer = window.setInterval(() => {
          const snapshot = this.game?.matchSnapshot() ?? null;
          if (snapshot?.finish && !this.matchResult) {
            this.matchResult = snapshot;
            const condition = this.game?.playerConditionSnapshot();
            if (condition) {
              COMPETITION_SESSION.recordFight(
                this.competitionMode,
                snapshot.winner === "player",
                condition
              );
            }
          }
        }, 100);
        // Clicks land on the canvas so keyboard input reaches the window.
        (this.$refs.canvas as HTMLCanvasElement).focus();
      } catch (err) {
        this.error = `Could not load ${character.label}: ${String(err)}`;
      } finally {
        this.loadingId = null;
      }
    },

    async rematch() {
      if (!this.selectedCharacter || !this.game) return;
      this.matchResult = null;
      this.movesetOpen = false;
      this.warning = "";
      try {
        const startingCondition =
          COMPETITION_SESSION.startCondition(this.competitionMode);
        const missing = await this.game.loadCharacter(
          this.selectedCharacter,
          this.selectedSetup ?? undefined,
          this.selectedOpponentSetup ?? undefined,
          this.selectedBotDifficulty,
          startingCondition
        );
        if (missing.length) {
          this.warning = `Missing animation clips: ${missing.join(", ")}`;
        }
        (this.$refs.canvas as HTMLCanvasElement).focus();
      } catch (err) {
        this.warning = `Could not start rematch: ${String(err)}`;
      }
    },

    forfeitMatch() {
      this.game?.forfeitPlayer();
    },

    applyMoveset(moveset: FighterMoveset) {
      if (!this.game?.setPlayerMoveset(moveset)) {
        this.warning = "Could not apply moveset to current fighter.";
        return;
      }
      this.warning = `Applied moveset: ${moveset.name}`;
    },

    reset() {
      this.started = false;
      this.movesetOpen = false;
      this.matchResult = null;
      window.clearInterval(this.resultTimer);
      this.resultTimer = 0;
      this.warning = "";
    },
  },
});
</script>

<style scoped>
.game {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0f1319;
}

.game__canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
  touch-action: none;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem 1rem;
  box-sizing: border-box;
  overflow-y: auto;
  background: rgba(12, 16, 22, 0.92);
  color: #f2f5f8;
  font-family: Avenir, Helvetica, Arial, sans-serif;
}

.overlay__title {
  margin: 0;
  font-size: clamp(1.4rem, 4vw, 2.2rem);
  letter-spacing: 0.02em;
}

.saved-fighters {
  width: min(100%, 46rem);
  display: grid;
  gap: 0.45rem;
}

.saved-fighters__row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.45rem;
}

.saved-fighters button {
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 0.35rem;
  background: rgba(255,255,255,0.06);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.saved-fighters__row button:first-child {
  display: grid;
  gap: 0.15rem;
}

.saved-fighters__row button:first-child span {
  opacity: 0.68;
  font-size: 0.74rem;
}

.overlay__error {
  color: #ff8a80;
  max-width: 40rem;
  text-align: center;
}

.fighter-setup {
  width: min(100%, 46rem);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
  padding: 1rem;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 0.75rem;
  background: rgba(255,255,255,0.04);
}

.fighter-setup label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.82rem;
}

.fighter-setup input,
.fighter-setup select {
  width: 100%;
  box-sizing: border-box;
}

.fighter-setup p {
  grid-column: 1 / -1;
  margin: 0;
  opacity: 0.65;
  font-size: 0.78rem;
}

.roster {
  display: grid;
  /* An explicit width is required: as a centred flex item the grid would
     otherwise shrink to its content and auto-fit could never wrap. */
  width: min(100%, 46rem);
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 1rem;
  justify-content: center;
}

.roster__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.1rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease,
    background 0.15s ease;
}

.roster__card:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: #6ea8ff;
  background: rgba(110, 168, 255, 0.14);
}

.roster__card:disabled {
  cursor: progress;
  opacity: 0.6;
}

.roster__swatch {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
}

.roster__name {
  font-weight: 600;
}

.roster__tone {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.6;
}

.roster__loading {
  font-size: 0.75rem;
  opacity: 0.8;
}

.overlay__back {
  padding: 0.45rem 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 0.4rem;
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.overlay__back:hover {
  background: rgba(255, 255, 255, 0.18);
}

.hud {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(transparent, rgba(10, 14, 20, 0.75));
  color: #eef2f6;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  font-size: 0.85rem;
  pointer-events: none;
}

.hud__keys {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
}

kbd {
  display: inline-block;
  min-width: 1.4rem;
  padding: 0.1rem 0.35rem;
  margin-right: 0.15rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-bottom-width: 2px;
  border-radius: 0.25rem;
  background: rgba(255, 255, 255, 0.1);
  font-family: inherit;
  font-size: 0.78rem;
  text-align: center;
}

.hud__change {
  margin-left: auto;
  padding: 0.35rem 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 0.4rem;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
  font: inherit;
  cursor: pointer;
  pointer-events: auto;
}

.hud__change:hover {
  background: rgba(255, 255, 255, 0.2);
}

.hud__hint {
  flex-basis: 100%;
  margin: 0;
  opacity: 0.65;
  font-size: 0.78rem;
}

.hud__warning {
  flex-basis: 100%;
  margin: 0;
  color: #ffcc80;
  font-size: 0.78rem;
}
.result {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  background: rgba(5, 8, 12, 0.72);
  color: #f2f5f8;
  pointer-events: auto;
}

.result__panel {
  width: min(30rem, calc(100vw - 2rem));
  padding: 1.25rem;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 0.75rem;
  background: rgba(16, 23, 34, 0.96);
  text-align: center;
}

.result__panel h2 {
  margin-top: 0;
}

.result__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: center;
  margin-top: 1rem;
}

.result__actions button {
  padding: 0.45rem 0.9rem;
  border: 1px solid rgba(255,255,255,0.28);
  border-radius: 0.4rem;
  background: rgba(255,255,255,0.08);
  color: inherit;
  cursor: pointer;
}

.result__actions button:hover {
  background: rgba(255,255,255,0.16);
}
</style>
