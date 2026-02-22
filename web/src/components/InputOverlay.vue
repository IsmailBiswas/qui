<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const store = useExplorationStore()
const question = ref('')
const inputRef = ref<InstanceType<typeof Input> | null>(null)

function handleKeydown(e: KeyboardEvent) {
  // Ctrl+K or Cmd+K for main question, Ctrl+L or Cmd+L for sub-question
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    store.showInput('main')
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault()
    if (store.activeNode) {
      store.showInput('sub')
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(
  () => store.inputVisible,
  (visible) => {
    if (visible) {
      question.value = ''
    }
  },
)

function submit() {
  const q = question.value.trim()
  if (!q) return

  if (store.inputMode === 'main') {
    // For now, add a placeholder answer — replace with real AI call
    store.addAnchorNode(q, 'This is a placeholder answer. Connect an AI provider to get real responses.')
  } else if (store.inputMode === 'sub' && store.activeNode) {
    const sub = store.addSubQuestion(store.activeNode.id, q)
    // Simulate AI response — replace with real AI call
    setTimeout(() => {
      store.updateSubQuestionAnswer(
        sub.anchorId,
        sub.id,
        `Placeholder explanation for "${q}" in the context of the current anchor answer.`,
      )
    }, 1000)
  }

  store.hideInput()
}

const dialogTitle = ref('')
const dialogDesc = ref('')

watch(
  () => store.inputMode,
  (mode) => {
    if (mode === 'main') {
      dialogTitle.value = 'Ask a Question'
      dialogDesc.value = 'This becomes the root anchored question.'
    } else {
      dialogTitle.value = 'Ask about the Answer'
      dialogDesc.value = 'This question will be answered using only the current anchor answer as context.'
    }
  },
  { immediate: true },
)
</script>

<template>
  <Dialog :open="store.inputVisible" @update:open="(v: boolean) => !v && store.hideInput()">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-sm">{{ dialogTitle }}</DialogTitle>
        <DialogDescription class="text-xs">{{ dialogDesc }}</DialogDescription>
      </DialogHeader>

      <form @submit.prevent="submit" class="flex gap-2 mt-2">
        <Input
          ref="inputRef"
          v-model="question"
          placeholder="Type your question..."
          autofocus
          class="flex-1 h-8 text-sm"
        />
        <Button type="submit" size="sm">Ask</Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
