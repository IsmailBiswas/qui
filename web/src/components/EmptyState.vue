<script setup lang="ts">
import { useExplorationStore } from '@/stores/exploration'

const store = useExplorationStore()

function openInput() {
  store.showInput('main')
}
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
    <h2 class="text-lg font-semibold text-foreground">Start Exploring</h2>
    <p class="text-sm text-muted-foreground max-w-sm">
      Press <kbd class="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⌘K</kbd> to ask your first question.
      The answer becomes your anchor — then drill into any concept without losing context.
    </p>
    <button
      class="mt-2 text-xs text-primary underline underline-offset-4 hover:text-primary/80"
      @click="openInput"
    >
      or click here to start
    </button>
  </div>
</template>
