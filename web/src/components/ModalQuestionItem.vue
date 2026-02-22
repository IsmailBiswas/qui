<script setup lang="ts">
import type { AnchorNode } from '@/types'

const props = defineProps<{
  node: AnchorNode
  isActive: boolean
}>()

const emit = defineEmits<{
  select: []
  explore: []
}>()
</script>

<template>
  <div
    class="flex border-b border-border transition-colors cursor-pointer"
    :class="isActive ? 'bg-muted' : 'hover:bg-muted/50'"
    @click="emit('select')"
  >
    <!-- Question text -->
    <div class="flex-1 px-4 py-3 min-w-0">
      <p class="text-xs font-medium leading-snug truncate">{{ node.question }}</p>
      <p class="text-[10px] text-muted-foreground mt-0.5">
        {{ node.subQuestions.length }} sub-question{{ node.subQuestions.length !== 1 ? 's' : '' }}
        · {{ node.childIds.length }} branch{{ node.childIds.length !== 1 ? 'es' : '' }}
      </p>
    </div>

    <!-- Full-height explore button -->
    <button
      class="w-10 shrink-0 flex items-center justify-center border-l border-border hover:bg-primary/10 hover:text-primary transition-colors"
      title="Explore"
      @click.stop="emit('explore')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  </div>
</template>
