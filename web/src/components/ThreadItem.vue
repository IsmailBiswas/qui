<script setup lang="ts">
import { useExplorationStore } from '@/stores/exploration'
import { Button } from '@/components/ui/button'
import type { SubQuestion } from '@/types'
import { computed } from 'vue'

const props = defineProps<{
  subQuestion: SubQuestion
}>()

const store = useExplorationStore()
const isSelected = computed(() => store.selectedSubQuestionId === props.subQuestion.id)

function select() {
  store.selectSubQuestion(props.subQuestion.id)
}

function promote(e: Event) {
  e.stopPropagation()
  store.promoteSubQuestion(props.subQuestion.anchorId, props.subQuestion.id)
}
</script>

<template>
  <div
    class="border-b border-border px-4 py-3 cursor-pointer transition-colors"
    :class="isSelected ? 'bg-muted' : 'hover:bg-muted/50'"
    @click="select"
  >
    <div class="flex items-start justify-between gap-2">
      <span class="text-xs font-medium leading-snug flex-1">{{ subQuestion.question }}</span>
      <span v-if="subQuestion.loading" class="text-[10px] text-muted-foreground animate-pulse shrink-0">...</span>
    </div>
    <div v-if="!subQuestion.loading && subQuestion.answer" class="mt-1.5 flex items-center gap-2">
      <p class="text-[10px] text-muted-foreground truncate flex-1">{{ subQuestion.answer.slice(0, 80) }}...</p>
      <Button variant="outline" size="sm" class="text-[10px] h-5 px-1.5 shrink-0" @click="promote">
        Promote
      </Button>
    </div>
  </div>
</template>
