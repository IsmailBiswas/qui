<script setup lang="ts">
import { useExplorationStore } from '@/stores/exploration'
import type { SubQuestion } from '@/types'
import { computed } from 'vue'
import { ArrowUpRight } from 'lucide-vue-next'

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
    class="border-b border-border flex cursor-pointer transition-colors"
    :class="isSelected ? 'bg-muted' : 'hover:bg-muted/50'"
    @click="select"
  >
    <!-- Main content -->
    <div class="flex-1 px-4 py-3 min-w-0">
      <div class="flex items-start gap-2">
        <span class="text-xs font-medium leading-snug flex-1">{{ subQuestion.question }}</span>
        <span v-if="subQuestion.loading" class="text-[10px] text-muted-foreground animate-pulse shrink-0">...</span>
      </div>
      <p v-if="!subQuestion.loading && subQuestion.answer" class="mt-1 text-[10px] text-muted-foreground truncate">
        {{ subQuestion.answer.slice(0, 80) }}...
      </p>
    </div>

    <!-- Full-height promote button -->
    <button
      v-if="!subQuestion.loading && subQuestion.answer"
      class="shrink-0 w-8 flex items-center justify-center border-l border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      title="Promote to anchor"
      @click="promote"
    >
      <ArrowUpRight class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
