<script setup lang="ts">
import { useExplorationStore } from '@/stores/exploration'
import { ScrollArea } from '@/components/ui/scroll-area'
import ThreadItem from '@/components/ThreadItem.vue'
import { computed } from 'vue'

const store = useExplorationStore()
const subQuestions = computed(() => store.activeNode?.subQuestions ?? [])
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b border-border shrink-0">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sub-Questions</p>
    </div>

    <ScrollArea class="flex-1">
      <div v-if="subQuestions.length === 0" class="px-4 py-8 text-center text-xs text-muted-foreground">
        No sub-questions yet.<br />
        Press <kbd class="px-1 py-0.5 rounded bg-muted text-[10px]">Space</kbd> to ask about the answer.
      </div>

      <div v-else class="flex flex-col">
        <ThreadItem
          v-for="sub in subQuestions"
          :key="sub.id"
          :sub-question="sub"
        />
      </div>
    </ScrollArea>
  </div>
</template>
