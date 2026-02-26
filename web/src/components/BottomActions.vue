<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
const shortcutsOpen = ref(false)

const shortcuts = [
  { keys: 'Shift + Space', action: 'New question' },
  { keys: 'Shift + H',     action: 'History' },
  { keys: 'Shift + ,',     action: 'Settings' },
  { keys: 'Space',         action: 'Ask sub-question (explore view)' },
  { keys: 'Esc',           action: 'Dismiss / go back' },
]

// Pie radius matches the resting arc (80px = w-20)
const R = 80
// 45° midpoint on the arc — point on circle at 45° from corner (R,R)
const mid = +(R - R / Math.SQRT2).toFixed(2)
// Icon centres — 55% of radius from corner, at 22.5° and 67.5°
const iconSettings = { x: +(R - R * 0.55 * 0.9239).toFixed(1), y: +(R - R * 0.55 * 0.3827).toFixed(1) }
const iconHelp     = { x: +(R - R * 0.55 * 0.3827).toFixed(1), y: +(R - R * 0.55 * 0.9239).toFixed(1) }
</script>

<template>
  <div class="fixed bottom-0 right-0 z-40 w-20 h-20">
    <svg
      :viewBox="`0 0 ${R} ${R}`"
      class="absolute inset-0 w-full h-full"
      style="overflow: visible;"
    >
        <!--
          Arc geometry: corner = bottom-right = (R,R), radius = R.
          Convex arc from (0,R) to (R,0) uses sweep-flag=1.
            Full quarter: M R R  L 0 R  A R R 0 0 1 R 0  Z
            Sector A (lower, settings): (0,R) → arc(sweep=1) → (mid,mid)
            Sector B (upper, help):     (mid,mid) → arc(sweep=1) → (R,0)
        -->

        <!-- Sector A — settings (wrench) -->
        <path
          :d="`M ${R} ${R} L 0 ${R} A ${R} ${R} 0 0 1 ${mid} ${mid} Z`"
          class="sector sector-a"
          @click="settingsStore.openSettings()"
        />
        <!-- Wrench icon (lucide path, 24×24 viewbox → scaled to ~14px, centred on iconSettings) -->
        <g
          :transform="`translate(${iconSettings.x - 7} ${iconSettings.y - 7}) scale(0.583)`"
          class="icon-overlay"
          style="pointer-events: none;"
        >
          <path
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        </g>

        <!-- Sector divider line -->
        <line
          :x1="R" :y1="R"
          :x2="mid" :y2="mid"
          class="sector-divider"
        />

        <!-- Sector B — help (?) -->
        <path
          :d="`M ${R} ${R} L ${mid} ${mid} A ${R} ${R} 0 0 1 ${R} 0 Z`"
          class="sector sector-b"
          @click="shortcutsOpen = !shortcutsOpen"
        />
        <!-- ? text -->
        <text
          :x="iconHelp.x"
          :y="iconHelp.y + 5"
          text-anchor="middle"
          class="icon-overlay"
          style="font-size: 14px; font-weight: 500; pointer-events: none; user-select: none; fill: currentColor;"
        >?</text>
    </svg>
  </div>

  <!-- Shortcuts modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="shortcutsOpen"
        class="fixed inset-0 z-50 flex items-center justify-center pb-64"
      >
        <div class="absolute inset-0 bg-black/0" @click="shortcutsOpen = false" />
        <div class="relative w-[80%] rounded-lg border border-border bg-card shadow-2xl px-8 py-6">
          <div class="flex items-center justify-between mb-5">
            <p class="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Keyboard Shortcuts</p>
            <button
              class="text-muted-foreground hover:text-foreground text-xs leading-none px-1"
              @click="shortcutsOpen = false"
            >x</button>
          </div>
          <div class="flex gap-0">
            <div class="flex-1 space-y-3 pr-8">
              <div
                v-for="s in shortcuts.slice(0, Math.ceil(shortcuts.length / 2))"
                :key="s.keys"
                class="flex items-center justify-between gap-4"
              >
                <span class="text-sm text-muted-foreground">{{ s.action }}</span>
                <kbd class="shrink-0 px-2 py-0.5 rounded bg-muted text-[11px] font-mono text-foreground border border-border">{{ s.keys }}</kbd>
              </div>
            </div>
            <div class="w-px bg-border self-stretch" />
            <div class="flex-1 space-y-3 pl-8">
              <div
                v-for="s in shortcuts.slice(Math.ceil(shortcuts.length / 2))"
                :key="s.keys"
                class="flex items-center justify-between gap-4"
              >
                <span class="text-sm text-muted-foreground">{{ s.action }}</span>
                <kbd class="shrink-0 px-2 py-0.5 rounded bg-muted text-[11px] font-mono text-foreground border border-border">{{ s.keys }}</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Pie sectors ── */
.sector {
  cursor: pointer;
  transition: fill 0.12s ease;
}
.sector-a {
  fill: rgb(63 63 70); /* zinc-700 */
}
.sector-a:hover {
  fill: rgb(82 82 91); /* zinc-600 */
}
.sector-b {
  fill: rgb(52 52 58); /* slightly different shade */
}
.sector-b:hover {
  fill: rgb(72 72 80);
}

/* Divider line between the two sectors */
.sector-divider {
  stroke: rgb(113 113 122); /* zinc-500 */
  stroke-width: 1;
  opacity: 0.5;
}

/* Icon colour */
.icon-overlay {
  color: rgb(212 212 216); /* zinc-300 */
  fill: rgb(212 212 216);
}

/* ── Transitions ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
