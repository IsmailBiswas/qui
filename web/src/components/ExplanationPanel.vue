<script setup lang="ts">
import { useExplorationStore } from '@/stores/exploration'
import { ScrollArea } from '@/components/ui/scroll-area'

const store = useExplorationStore()
</script>

<template>
  <div class="h-full flex flex-col">
    <template v-if="store.selectedSubQuestion">
      <!-- Sub-question header -->
      <div class="px-6 py-4 border-b border-border shrink-0">
        <p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Sub-Question</p>
        <p class="text-sm font-medium">{{ store.selectedSubQuestion.question }}</p>
      </div>

      <!-- Sub-question answer body -->
      <ScrollArea class="flex-1">
        <div class="px-6 py-4">
          <div v-if="store.selectedSubQuestion.loading" class="text-sm text-muted-foreground animate-pulse">
            Thinking...
          </div>
          <p v-else class="text-sm leading-relaxed whitespace-pre-wrap">{{ store.selectedSubQuestion.answer }}</p>
        </div>
      </ScrollArea>
    </template>

    <!-- Empty state: no sub-question selected -->
    <div v-else class="h-full flex items-center justify-center">
      <p class="text-xs text-muted-foreground">Select a sub-question to view its answer</p>
    </div>
  </div>
</template>
