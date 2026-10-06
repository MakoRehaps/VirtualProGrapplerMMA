<template>
  <div class="game">
    <canvas ref="canvas" class="game__canvas" />

    <!-- Character selection overlay, shown until a character is chosen. -->
    <div v-if="!started" class="overlay">
      <h1 class="overlay__title">Choose your character</h1>
      <p class="overlay__mode">
        {{ competitionModeName }}
        <template v-if="eventStatusText"> · {{ eventStatusText }}</template>
      </p>

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

        <label v-if="competitionMode === 'local_vs'">
          P2 model
          <select v-model="opponentCharacterId">
            <option
              v-for="character in characters"
              :key="`p2-model-${character.id}`"
              :value="character.id"
            >
              {{ character.label }}
            </option>
          </select>
        </label>

        <label v-if="competitionMode === 'local_vs'">
          P2 saved build
          <select v-model="opponentPresetName" @change="applyOpponentPreset">
            <option value="">Custom</option>
            <option
              v-for="preset in fighterPresets"
              :key="`p2-build-${preset.name}`"
              :value="preset.name"
            >
              {{ preset.name }}
            </option>
          </select>
        </label>

        <label v-if="competitionMode === 'local_vs'">
          P2 name
          <input v-model.trim="opponentName" maxlength="24" />
        </label>

        <label
          v-if="
            competitionMode === 'local_vs' ||
            competitionMode === 'practice_coach'
          "
        >
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

        <label
          v-if="
            competitionMode !== 'local_vs' &&
            competitionMode !== 'practice_coach' &&
            eventOpponentStyleName
          "
        >
          Event opponent
          <span>{{ eventOpponentStyleName }}</span>
        </label>

        <label v-if="competitionMode === 'local_vs'">
          P2 moveset
          <select v-model="opponentMovesetName">
            <option value="">Default</option>
            <option
              v-for="moveset in opponentSavedMovesets"
              :key="`p2-${moveset.name}`"
              :value="moveset.name"
            >
              {{ moveset.name }}
            </option>
          </select>
        </label>

        <label v-if="competitionMode !== 'local_vs'">
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
          P1 height
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
          P1 weight
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
          P1 reach
          <input
            v-model.number="fighterReach"
            type="range"
            :min="reachMin"
            :max="reachMax"
            step="0.01"
          />
          <span>{{ fighterReach.toFixed(2) }} m</span>
        </label>

        <template v-if="competitionMode === 'local_vs'">
          <label>
            P2 height
            <input
              v-model.number="opponentHeight"
              type="range"
              :min="bodyBounds.min_height_m"
              :max="bodyBounds.max_height_m"
              step="0.01"
            />
            <span>{{ opponentHeight.toFixed(2) }} m</span>
          </label>

          <label>
            P2 weight
            <input
              v-model.number="opponentMass"
              type="range"
              :min="bodyBounds.min_mass_kg"
              :max="bodyBounds.max_mass_kg"
              step="1"
            />
            <span>{{ opponentMass.toFixed(0) }} kg</span>
          </label>

          <label>
            P2 reach
            <input
              v-model.number="opponentReach"
              type="range"
              :min="opponentReachMin"
              :max="opponentReachMax"
              step="0.01"
            />
            <span>{{ opponentReach.toFixed(2) }} m</span>
          </label>
        </template>

        <p>
          No weight classes. Body size changes continuous physics only;
          HP stays 100.
          <template v-if="competitionMode === 'local_vs'">
            Local VS requires two XInput-compatible controllers: P1 uses pad 1,
            P2 uses pad 2.
          </template>
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
      :opponent-moveset-source="
        competitionMode === 'local_vs'
          ? () => game?.opponentMovesetSnapshot() ?? null
          : undefined
      "
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
          <button v-if="canRematch" @click="rematch">Rematch</button>
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
      <button class="hud__change" @click="saveCurrentFighter">Save P1 Fighter</button>
      <button
        v-if="competitionMode === 'local_vs'"
        class="hud__change"
        @click="saveOpponentFighter"
      >
        Save P2 Fighter
      </button>
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
import { listMovesets, loadMoveset } from "@/combat/movesetStore";
import type { FighterLoadout } from "@/combat/mayQuvTypes";
import type { BotDifficultyId } from "@/ai/BotBrain";
import { gamepadSlotConnected } from "@/game/GamepadTechniqueInput";
import {
  BODY_PHYSICS,
  STYLES,
  competitionModeById,
  styleById,
} from "@/data/combatCatalog";
import {
  COMPETITION_SESSION,
  modeForRoute,
  type CompetitionModeId,
} from "@/competition/CompetitionSession";
import { eventOpponentStyleId } from "@/competition/eventOpponent";
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
      opponentCharacterId: CHARACTERS[1]?.id ?? CHARACTERS[0].id,
      opponentName: "P2",
      opponentPresetName: "",
      opponentMovesetName: "",
      opponentHeight: 1.82,
      opponentMass: 82,
      opponentReach: 1.86,
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
      selectedOpponentCharacter: null as CharacterDefinition | null,
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

    opponentReachMin(): number {
      return Math.round(
        this.opponentHeight *
          this.bodyBounds.min_reach_to_height_ratio *
          100
      ) / 100;
    },

    opponentReachMax(): number {
      return Math.round(
        this.opponentHeight *
          this.bodyBounds.max_reach_to_height_ratio *
          100
      ) / 100;
    },

    opponentSavedMovesets() {
      return listMovesets(this.opponentStyle);
    },

    eventOpponentStyleName(): string {
      const id = eventOpponentStyleId(
        this.competitionMode,
        COMPETITION_SESSION.snapshot()
      );
      return id ? styleById(id)?.name ?? id : "";
    },

    competitionModeName(): string {
      return (
        competitionModeById(this.competitionMode)?.name ??
        this.competitionMode
      );
    },

    eventStatusText(): string {
      const status = COMPETITION_SESSION.snapshot();

      if (
        this.competitionMode === "weekly_qualifier" ||
        this.competitionMode === "weekly_tournament"
      ) {
        if (status.weeklyQualified) {
          return this.competitionMode === "weekly_tournament"
            ? `Weekly round ${status.weeklyTournamentWins + 1} of ${COMPETITION_SESSION.weeklyRoundsRequired}`
            : "Weekly qualified";
        }
        return "Weekly qualifier required";
      }

      if (
        this.competitionMode === "monthly_qualifier_one" ||
        this.competitionMode === "monthly_qualifier_two" ||
        this.competitionMode === "monthly_grand_tournament"
      ) {
        if (status.monthlyQualifierTwoWon) {
          return this.competitionMode === "monthly_grand_tournament"
            ? `Grand Tournament round ${status.monthlyTournamentWins + 1} of ${COMPETITION_SESSION.monthlyRoundsRequired}`
            : "Monthly qualifiers complete";
        }
        if (status.monthlyQualifierOneWon) {
          return "Monthly Qualifier I complete";
        }
        return "Monthly qualification not started";
      }

      return "";
    },

    canRematch(): boolean {
      return (
        this.competitionMode === "normal_mp" ||
        this.competitionMode === "local_vs" ||
        this.competitionMode === "practice_coach"
      );
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

      const status = COMPETITION_SESSION.snapshot();
      if (
        this.competitionMode === "weekly_tournament" &&
        status.weeklyQualified
      ) {
        return "match_setup.pay_per_view";
      }
      if (
        this.competitionMode === "monthly_grand_tournament" &&
        status.monthlyQualifierOneWon &&
        status.monthlyQualifierTwoWon
      ) {
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

      const status = COMPETITION_SESSION.snapshot();
      if (this.competitionMode === "weekly_tournament") {
        return `Continue to Weekly Round ${status.weeklyTournamentWins + 1}`;
      }
      if (this.competitionMode === "monthly_grand_tournament") {
        return `Continue to Grand Tournament Round ${status.monthlyTournamentWins + 1}`;
      }

      return "";
    },

    resultTitle(): string {
      if (!this.matchResult) return "";
      if (!this.matchResult.winner) return "Draw";

      if (this.competitionMode === "local_vs") {
        return this.matchResult.winner === "player"
          ? `${this.matchResult.player.name} wins`
          : `${this.matchResult.opponent.name} wins`;
      }

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

    applyOpponentPreset() {
      if (!this.opponentPresetName) return;
      const preset = this.fighterPresets.find(
        (x) => x.name === this.opponentPresetName
      );
      if (!preset) return;

      this.opponentCharacterId = preset.characterId;
      this.opponentName = preset.setup.name ?? preset.name;
      this.opponentStyle = preset.setup.styleId;
      this.opponentHeight = preset.setup.body.heightM;
      this.opponentMass = preset.setup.body.massKg;
      this.opponentReach = preset.setup.body.reachM;
      this.opponentMovesetName = preset.movesetName ?? "";
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

    saveOpponentFighter() {
      if (!this.selectedOpponentCharacter || !this.selectedOpponentSetup) {
        this.warning = "Start Local VS once before saving the P2 build.";
        return;
      }

      saveFighterPreset({
        version: 1,
        name:
          this.selectedOpponentSetup.name?.trim() ||
          this.opponentName ||
          "P2",
        characterId: this.selectedOpponentCharacter.id,
        movesetName: this.game?.currentOpponentMoveset?.name,
        setup: {
          ...this.selectedOpponentSetup,
          body: { ...this.selectedOpponentSetup.body },
        },
      });
      this.refreshFighterPresets();
      this.warning = "P2 fighter build saved.";
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
        if (
          this.competitionMode === "local_vs" &&
          (!gamepadSlotConnected(0) || !gamepadSlotConnected(1))
        ) {
          this.error =
            "Local VS requires two connected XInput-compatible controllers.";
          return;
        }

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
        const automaticOpponentStyleId = eventOpponentStyleId(
          this.competitionMode,
          COMPETITION_SESSION.snapshot()
        );
        const resolvedOpponentStyleId =
          automaticOpponentStyleId ?? this.opponentStyle;
        const opponentStyle = styleById(resolvedOpponentStyleId);
        const opponentSetup = {
          name:
            this.competitionMode === "local_vs"
              ? this.opponentName || "P2"
              : "Opponent",
          styleId: resolvedOpponentStyleId,
          stanceId:
            opponentStyle?.default_stance ?? "neutral_fighting",
          body: {
            massKg:
              this.competitionMode === "local_vs"
                ? this.opponentMass
                : 82,
            heightM:
              this.competitionMode === "local_vs"
                ? this.opponentHeight
                : 1.82,
            reachM:
              this.competitionMode === "local_vs"
                ? this.opponentReach
                : 1.86,
            centerOfMassHeightRatio: 0.56,
          },
        };
        const startingCondition =
          COMPETITION_SESSION.startCondition(this.competitionMode);
        const opponentCharacter =
          this.competitionMode === "local_vs"
            ? this.characters.find(
                (x) => x.id === this.opponentCharacterId
              )
            : undefined;
        const missing = await this.game!.loadCharacter(
          character,
          setup,
          opponentSetup,
          this.botDifficulty,
          startingCondition,
          competitionModeById(this.competitionMode)?.ruleset_id ??
            "may_quv_standard",
          this.competitionMode === "local_vs",
          opponentCharacter
        );
        if (missing.length) {
          this.warning = `Missing animation clips: ${missing.join(", ")}`;
        }
        if (
          this.competitionMode === "local_vs" &&
          this.opponentMovesetName
        ) {
          const p2Moveset = loadMoveset(
            this.opponentStyle,
            this.opponentMovesetName
          );
          if (p2Moveset) this.game?.setOpponentMoveset(p2Moveset);
        }
        this.selectedCharacter = character;
        this.selectedOpponentCharacter = opponentCharacter ?? null;
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
          startingCondition,
          competitionModeById(this.competitionMode)?.ruleset_id ??
            "may_quv_standard",
          this.competitionMode === "local_vs",
          this.selectedOpponentCharacter ?? undefined
        );
        if (missing.length) {
          this.warning = `Missing animation clips: ${missing.join(", ")}`;
        }
        if (
          this.competitionMode === "local_vs" &&
          this.opponentMovesetName
        ) {
          const p2Moveset = loadMoveset(
            this.opponentStyle,
            this.opponentMovesetName
          );
          if (p2Moveset) this.game.setOpponentMoveset(p2Moveset);
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

.overlay__mode {
  margin: -1rem 0 0;
  opacity: 0.72;
  font-size: 0.85rem;
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
