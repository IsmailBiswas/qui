<script setup lang="ts">
import { useExplorationStore } from '@/stores/exploration'
import { ScrollArea } from '@/components/ui/scroll-area'
import { computed } from 'vue'

const store = useExplorationStore()
const node = computed(() => store.activeNode!)
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Question header -->
    <div class="px-6 py-4 border-b border-border shrink-0">
      <p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Question</p>
      <p class="text-sm font-medium">{{ node.question }}</p>
    </div>

    <!-- Answer body -->
    <ScrollArea class="flex-1">
      <div class="px-6 py-4">
        <p class="text-sm leading-relaxed whitespace-pre-wrap">{{ node.answer }}</p>
      </div>
    </ScrollArea>
  </div>
</template>
