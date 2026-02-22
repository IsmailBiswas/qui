<script setup lang="ts">
import { useExplorationStore } from '@/stores/exploration'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ThreadItem from '@/components/ThreadItem.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { askSubQuestion } from '@/services/ai'

const store = useExplorationStore()

const subQuestions = computed(() => store.activeNode?.subQuestions ?? [])
const hasNode = computed(() => !!store.activeNode)

const showSubInput = ref(false)
const subQuestion = ref('')

function toggleSubInput() {
  showSubInput.value = !showSubInput.value
  subQuestion.value = ''
}

async function submitSubQuestion() {
  const q = subQuestion.value.trim()
  if (!q || !store.activeNode) return

  const sub = store.addSubQuestion(store.activeNode.id, q)
  subQuestion.value = ''
  showSubInput.value = false

  try {
    const answer = await askSubQuestion(store.activeNode.answer, q)
    store.updateSubQuestionAnswer(sub.anchorId, sub.id, answer)
  } catch (err) {
    store.updateSubQuestionAnswer(sub.anchorId, sub.id, 'Error: failed to get response.')
    console.error('AI request failed:', err)
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'l' && store.viewMode === 'anchored' && store.activeNode) {
    e.preventDefault()
    showSubInput.value = true
  }
}

onMounted(() => window.addEventListener('keydown', handleGlobalKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleGlobalKeydown))
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sub-Questions</p>
      <Button v-if="hasNode" variant="ghost" size="sm" class="text-xs h-7" @click="toggleSubInput">
        + Ask
      </Button>
    </div>

    <!-- Inline sub-question input -->
    <div v-if="showSubInput" class="px-4 py-2 border-b border-border shrink-0">
      <form class="flex gap-1.5" @submit.prevent="submitSubQuestion">
        <Input
          v-model="subQuestion"
          placeholder="Ask about the answer..."
          autofocus
          class="flex-1 h-7 text-xs"
        />
        <Button type="submit" size="sm" class="h-7 text-xs">Go</Button>
      </form>
    </div>

    <ScrollArea class="flex-1">
      <div v-if="subQuestions.length === 0" class="px-4 py-8 text-center text-xs text-muted-foreground">
        No sub-questions yet.<br />
        Press <kbd class="px-1 py-0.5 rounded bg-muted text-[10px]">Ctrl+L</kbd> to ask about the answer.
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
