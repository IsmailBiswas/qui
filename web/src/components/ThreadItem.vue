<script setup lang="ts">
import { ref } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import type { SubQuestion } from '@/types'
import { computed } from 'vue'
import { ArrowUpRight } from 'lucide-vue-next'

const props = defineProps<{
  subQuestion: SubQuestion
}>()

const store = useExplorationStore()
const isSelected = computed(() => store.selectedSubQuestionId === props.subQuestion.id)

const confirming = ref(false)
const deleting = ref(false)

function select() {
  store.selectSubQuestion(props.subQuestion.id)
}

function promote(e: Event) {
  e.stopPropagation()
  store.promoteSubQuestion(props.subQuestion.anchorId, props.subQuestion.id)
}

function startConfirm() {
  confirming.value = true
}

function confirmDelete() {
  confirming.value = false
  deleting.value = true
  setTimeout(() => store.deleteSubQuestion(props.subQuestion.anchorId, props.subQuestion.id), 300)
}

function cancelDelete() {
  confirming.value = false
}
</script>

<template>
  <div
    class="border-b border-border flex cursor-pointer overflow-hidden"
    style="transition: max-height 300ms ease, opacity 300ms ease, background-color 150ms ease"
    :class="[
      deleting ? 'max-h-0 opacity-0' : 'max-h-24 opacity-100',
      isSelected ? 'bg-muted' : 'hover:bg-muted/50',
    ]"
    @click="select"
  >
    <!-- Delete button + inline confirmation -->
    <div class="flex shrink-0 border-r border-border overflow-hidden">
      <button
        class="w-8 shrink-0 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
        :class="confirming ? 'text-destructive' : ''"
        title="Delete"
        @click.stop="startConfirm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>

      <div
        class="flex items-center overflow-hidden"
        style="transition: max-width 300ms ease"
        :style="confirming ? 'max-width: 5.5rem' : 'max-width: 0'"
      >
        <div class="flex border-l border-border h-full">
          <button
            class="px-2 text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors h-full"
            @click.stop="confirmDelete"
          >Yes</button>
          <button
            class="px-2 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors h-full border-l border-border"
            @click.stop="cancelDelete"
          >No</button>
        </div>
      </div>
    </div>

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
