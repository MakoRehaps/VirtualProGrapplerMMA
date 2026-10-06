<template>
  <div class="editor">
    <div class="editor__panel">
      <header class="editor__header">
        <div>
          <h2>Moveset Builder</h2>
          <p>{{ draft.styleId }} · all gameplay moves are free</p>
        </div>
        <button @click="$emit('close')">Close</button>
      </header>

      <div class="editor__preset">
        <label>
          Preset name
          <input v-model.trim="draft.name" maxlength="32" />
        </label>
        <button @click="save">Save</button>
        <button @click="apply">Apply</button>
        <button :disabled="draft.name === 'Default'" @click="remove">Delete</button>
      </div>

      <div class="editor__saved" v-if="saved.length">
        <span>Saved:</span>
        <button
          v-for="preset in saved"
          :key="preset.name"
          @click="load(preset)"
        >
          {{ preset.name }}
        </button>
      </div>

      <section
        v-for="context in contexts"
        :key="context.id"
        class="editor__context"
      >
        <h3>{{ context.label }}</h3>

        <div class="slots">
          <label
            v-for="slot in context.slots"
            :key="slot.slot_id"
            class="slot"
          >
            <span class="slot__button">{{ slot.button.toUpperCase() }}</span>
            <select
              :value="draft.slots[slot.slot_id] ?? ''"
              @change="assign(slot.slot_id, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Empty</option>
              <option
                v-for="technique in legal(context.id)"
                :key="technique.techniqueId"
                :value="technique.techniqueId"
              >
                {{ technique.name }}
              </option>
            </select>
          </label>
        </div>
      </section>

      <p v-if="status" class="editor__status">{{ status }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import {
  assignTechnique,
  legalTechniquesForMovesetContext,
  MOVESET_LAYOUT,
  type FighterMoveset,
  type MovesetContext,
} from "@/combat/moveset";
import {
  deleteMoveset,
  listMovesets,
  saveMoveset,
} from "@/combat/movesetStore";

export default defineComponent({
  name: "MovesetEditor",

  props: {
    moveset: {
      type: Object as PropType<FighterMoveset>,
      required: true,
    },
  },

  emits: {
    close: () => true,
    apply: (_moveset: FighterMoveset) => true,
  },

  data() {
    return {
      draft: {
        ...this.moveset,
        slots: { ...this.moveset.slots },
      } as FighterMoveset,
      status: "",
      saved: [] as FighterMoveset[],
      contexts: [
        {
          id: "standing" as MovesetContext,
          label: "Standing",
          slots: MOVESET_LAYOUT.contexts.standing.slots,
        },
        {
          id: "clinch" as MovesetContext,
          label: "Clinch",
          slots: MOVESET_LAYOUT.contexts.clinch.slots,
        },
        {
          id: "grounded_opponent" as MovesetContext,
          label: "Grounded Opponent",
          slots: MOVESET_LAYOUT.contexts.grounded_opponent.slots,
        },
      ],
    };
  },

  mounted() {
    this.refreshSaved();
  },

  methods: {
    legal(context: MovesetContext) {
      return legalTechniquesForMovesetContext(this.draft.styleId, context);
    },

    assign(slotId: string, techniqueId: string) {
      try {
        this.draft = assignTechnique(
          this.draft,
          slotId,
          techniqueId || null
        );
        this.status = "";
      } catch (err) {
        this.status = String(err);
      }
    },

    save() {
      if (!this.draft.name.trim()) {
        this.status = "Give this moveset a name first.";
        return;
      }

      try {
        saveMoveset(this.draft);
        this.refreshSaved();
        this.status = `Saved ${this.draft.name}`;
      } catch (err) {
        this.status = String(err);
      }
    },

    apply() {
      this.$emit("apply", {
        ...this.draft,
        slots: { ...this.draft.slots },
      });
      this.status = "Applied to current fighter";
    },

    load(preset: FighterMoveset) {
      this.draft = {
        ...preset,
        slots: { ...preset.slots },
      };
      this.status = `Loaded ${preset.name}`;
    },

    remove() {
      if (deleteMoveset(this.draft.styleId, this.draft.name)) {
        this.refreshSaved();
        this.status = `Deleted ${this.draft.name}`;
      }
    },

    refreshSaved() {
      this.saved = listMovesets(this.draft.styleId);
    },
  },
});
</script>

<style scoped>
.editor {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(5, 8, 12, 0.9);
  color: #f2f5f8;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  pointer-events: auto;
}

.editor__panel {
  width: min(58rem, 96vw);
  max-height: 92vh;
  overflow: auto;
  padding: 1rem;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 0.75rem;
  background: #101722;
}

.editor__header,
.editor__preset,
.editor__saved {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.editor__header {
  justify-content: space-between;
}

.editor__header h2 {
  margin: 0;
}

.editor__header p {
  margin: 0.2rem 0 0;
  opacity: 0.65;
  font-size: 0.8rem;
}

.editor__preset,
.editor__saved {
  margin-top: 1rem;
}

.editor__preset label {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

input,
select,
button {
  border: 1px solid rgba(255,255,255,0.24);
  border-radius: 0.35rem;
  background: #1a2331;
  color: inherit;
  padding: 0.42rem 0.55rem;
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  opacity: 0.45;
  cursor: default;
}

.editor__context {
  margin-top: 1.15rem;
}

.editor__context h3 {
  margin: 0 0 0.55rem;
  font-size: 0.95rem;
}

.slots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.slot {
  display: grid;
  grid-template-columns: 2rem 1fr;
  align-items: center;
  gap: 0.5rem;
}

.slot__button {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  font-weight: 800;
}

.slot select {
  width: 100%;
}

.editor__status {
  margin: 1rem 0 0;
  color: #ffd166;
}

@media (max-width: 640px) {
  .slots {
    grid-template-columns: 1fr;
  }
}
</style>
