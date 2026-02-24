<script setup lang="ts">
import { ref } from 'vue'
import type { AnchorNode } from '@/types'

const props = defineProps<{
  node: AnchorNode
  isActive: boolean
}>()

const emit = defineEmits<{
  select: []
  explore: []
  delete: []
}>()

const confirming = ref(false)
const deleting = ref(false)

function startConfirm() {
  confirming.value = true
}

function confirmDelete() {
  confirming.value = false
  deleting.value = true
  // Wait for collapse animation to finish then emit
  setTimeout(() => emit('delete'), 300)
}

function cancelDelete() {
  confirming.value = false
}
</script>

<template>
  <div
    class="flex border-b border-l border-border cursor-pointer overflow-hidden"
    style="transition: max-height 300ms ease, opacity 300ms ease, background-color 150ms ease"
    :class="[
      deleting ? 'max-h-0 opacity-0' : 'max-h-24 opacity-100',
      isActive ? 'bg-muted' : 'hover:bg-muted/50',
    ]"
    @click="emit('select')"
  >
    <!-- Delete button + inline confirmation -->
    <div class="flex shrink-0 border-r border-border overflow-hidden">
      <!-- Bin icon -->
      <button
        class="w-10 shrink-0 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
        :class="confirming ? 'text-destructive' : ''"
        title="Delete"
        @click.stop="startConfirm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>

      <!-- Expanding confirmation panel -->
      <div
        class="flex items-center overflow-hidden transition-[max-width] duration-300 ease-in-out"
        :class="confirming ? 'max-w-[5.5rem]' : 'max-w-0'"
      >
        <div class="flex border-l border-border h-full">
          <button
            class="px-2.5 text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors h-full"
            @click.stop="confirmDelete"
          >Yes</button>
          <button
            class="px-2.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors h-full border-l border-border"
            @click.stop="cancelDelete"
          >No</button>
        </div>
      </div>
    </div>

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
      class="w-10 shrink-0 flex items-center justify-center border-l border-r border-border hover:bg-primary/10 hover:text-primary transition-colors"
      title="Explore"
      @click.stop="emit('explore')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  </div>
</template>
