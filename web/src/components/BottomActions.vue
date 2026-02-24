<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)

const shortcuts = [
  { keys: 'Shift + Space', action: 'New question' },
  { keys: 'Shift + H',     action: 'History' },
  { keys: 'Shift + ,',     action: 'Settings' },
  { keys: 'Space',         action: 'Ask sub-question (explore view)' },
  { keys: 'Esc',           action: 'Dismiss / go back' },
]
</script>

<template>
  <!-- Arc button in bottom-right corner -->
  <button
    class="fixed bottom-0 right-0 z-40 w-20 h-20 bg-zinc-600 border-t border-l border-zinc-500 flex items-center justify-center text-sm font-medium text-zinc-200 hover:text-white hover:bg-zinc-500 transition-colors"
    style="border-top-left-radius: 100%;"
    @click="open = !open"
  >
    <span class="translate-x-2 translate-y-2 select-none">?</span>
  </button>

  <!-- Centered shortcuts modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center pb-64"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="open = false" />

        <!-- Panel — same 80% width as history modal -->
        <div class="relative w-[80%] rounded-lg border border-border bg-card shadow-2xl px-8 py-6">
          <div class="flex items-center justify-between mb-5">
            <p class="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Keyboard Shortcuts</p>
            <button
              class="text-muted-foreground hover:text-foreground text-xs leading-none px-1"
              @click="open = false"
            >
              x
            </button>
          </div>
          <div class="flex gap-0">
            <!-- Left column -->
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

            <!-- Vertical divider -->
            <div class="w-px bg-border self-stretch" />

            <!-- Right column -->
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
