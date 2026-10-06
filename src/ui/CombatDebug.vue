<template>
  <div v-if="snapshot" class="debug">
    <div class="debug__head">
      <strong>MAY' QUV Combat</strong>
      <span>{{ fightClock }}</span>
      <span v-if="snapshot.finish">
        {{ snapshot.winner ?? 'draw' }} / {{ snapshot.finish }}
      </span>
    </div>

    <div v-if="snapshot.decision" class="decision">
      Decision score · Player {{ snapshot.decision.player }}
      · Opponent {{ snapshot.decision.opponent }}
      · margin {{ snapshot.decision.margin }}
    </div>

    <div v-if="moveset" class="moveset">
      <strong>{{ moveset.movesetName }}</strong>
      <span>{{ moveset.positionId }}</span>
      <span v-for="button in (['a','b','x','y'] as const)" :key="button">
        {{ button.toUpperCase() }}:
        {{ moveset.buttons[button]?.name ?? '—' }}
      </span>
    </div>

    <div class="fighters">
      <section v-for="side in (['player', 'opponent'] as const)" :key="side">
        <header>{{ snapshot[side].name }} · {{ snapshot[side].styleId }}</header>

        <div v-for="bar in bars" :key="bar.key" class="row">
          <span>{{ bar.label }}</span>
          <progress :value="snapshot[side][bar.key]" max="100" />
          <span>{{ snapshot[side][bar.key] }}</span>
        </div>

        <div v-for="part in regions" :key="part.key" class="row row--region">
          <span>{{ part.label }}</span>
          <progress :value="snapshot[side].regions[part.key]" max="100" />
          <span>{{ snapshot[side].regions[part.key].toFixed(0) }}</span>
        </div>
      </section>
    </div>

    <div class="log">
      <div v-for="(entry, i) in snapshot.history" :key="i">
        f{{ entry.frame }} · {{ entry.techniqueName }}
        <template v-if="entry.connected && entry.resolution">
          · {{ entry.resolution.hpDamage }} hp
          · {{ entry.resolution.regionalDamage }} {{ entry.resolution.targetRegion }}
        </template>
        <template v-else> · {{ entry.missReason }}</template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import type { MayQuvMatchSnapshot } from "@/combat/MayQuvMatch";

type BarKey = "hp" | "stamina" | "consciousness" | "balance";

export default defineComponent({
  name: "CombatDebug",
  props: {
    source: {
      type: Function as PropType<() => MayQuvMatchSnapshot | null>,
      required: true,
    },
    frameSource: {
      type: Function as PropType<() => number>,
      required: true,
    },
    movesetSource: {
      type: Function as PropType<() => {
        movesetName: string;
        positionId: string;
        buttons: Record<string, { techniqueId: string; name: string } | null>;
      } | null>,
      required: false,
      default: null,
    },
  },
  data() {
    return {
      snapshot: null as MayQuvMatchSnapshot | null,
      frame: 0,
      moveset: null as {
        movesetName: string;
        positionId: string;
        buttons: Record<string, { techniqueId: string; name: string } | null>;
      } | null,
      timer: 0,
      bars: [
        { key: "hp" as BarKey, label: "HP" },
        { key: "stamina" as BarKey, label: "Stam" },
        { key: "consciousness" as BarKey, label: "Con" },
        { key: "balance" as BarKey, label: "Bal" },
      ],
      regions: [
        { key: "head" as const, label: "Head" },
        { key: "body" as const, label: "Body" },
        { key: "leftArm" as const, label: "L Arm" },
        { key: "rightArm" as const, label: "R Arm" },
        { key: "leftLeg" as const, label: "L Leg" },
        { key: "rightLeg" as const, label: "R Leg" },
      ],
    };
  },
  computed: {
    fightClock(): string {
      if (!this.snapshot) return "00:00";
      const limit = this.snapshot.timeLimitFrames;
      if (limit === null) return "Practice";

      const remaining = Math.max(
        0,
        limit - this.snapshot.elapsedFrames
      );
      const seconds = Math.ceil(remaining / 60);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    },
  },

  mounted() {
    this.timer = window.setInterval(() => {
      this.snapshot = this.source();
      this.frame = this.frameSource();
      this.moveset = this.movesetSource ? this.movesetSource() : null;
    }, 100);
  },
  beforeUnmount() {
    window.clearInterval(this.timer);
  },
});
</script>

<style scoped>
.debug {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  width: min(36rem, calc(100vw - 1.5rem));
  padding: 0.7rem;
  background: rgba(10, 14, 20, 0.84);
  color: #eef2f6;
  font: 0.7rem/1.35 ui-monospace, Consolas, monospace;
  pointer-events: none;
}
.debug__head,
.row {
  display: grid;
  grid-template-columns: 4.5rem 1fr 3rem;
  gap: 0.45rem;
  align-items: center;
}
.debug__head {
  grid-template-columns: auto auto 1fr;
  margin-bottom: 0.55rem;
}
.decision {
  margin-bottom: 0.45rem;
  padding: 0.3rem 0.4rem;
  border: 1px solid rgba(255,255,255,0.12);
}

.moveset {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  margin-bottom: 0.55rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid rgba(255,255,255,0.15);
}

.fighters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
}
section header {
  margin-bottom: 0.3rem;
  font-weight: 700;
}
.row--region {
  opacity: 0.82;
}
progress {
  width: 100%;
  height: 0.55rem;
}
.log {
  margin-top: 0.55rem;
  padding-top: 0.45rem;
  border-top: 1px solid rgba(255,255,255,0.15);
  max-height: 7rem;
  overflow: hidden;
}
</style>
