<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { askMainQuestion, askSubQuestion } from '@/services/ai'

const store = useExplorationStore()
const question = ref('')
const loading = ref(false)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit(false)
  } else if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault()
    submit(true)
  }
}

async function submit(anchor: boolean) {
  const q = question.value.trim()
  if (!q || loading.value) return

  loading.value = true
  question.value = ''

  try {
    if (!store.activeNode) {
      const answer = await askMainQuestion(q)
      store.addAnchorNode(q, answer)
    } else if (store.viewMode === 'modal') {
      const sub = store.addSubQuestion(store.activeNode.id, q)
      const answer = await askSubQuestion(store.activeNode.answer, q)
      store.updateSubQuestionAnswer(sub.anchorId, sub.id, answer)
    }
  } catch (err) {
    console.error('AI request failed:', err)
  } finally {
    loading.value = false
  }

  if (anchor) {
    nextTick(() => {
      store.transitionToAnchored()
    })
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col">
    <!-- Scrollable content area -->
    <ScrollArea class="flex-1 min-h-0">
      <!-- Empty state -->
      <div
        v-if="!store.activeNode"
        class="h-full flex flex-col items-center justify-center px-8 py-16 text-center"
      >
        <h2 class="text-lg font-semibold text-foreground mb-2">Start Exploring</h2>
        <p class="text-xs text-muted-foreground max-w-sm">
          Type a question below. Press <kbd class="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd>
          to ask, or <kbd class="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Shift+Enter</kbd>
          to ask and expand into the full workspace.
        </p>
      </div>

      <!-- Q&A content -->
      <div v-else class="px-6 py-4 space-y-4">
        <!-- Main question + answer -->
        <div>
          <p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Question</p>
          <p class="text-sm font-medium mb-3">{{ store.activeNode.question }}</p>
          <p class="text-sm leading-relaxed whitespace-pre-wrap">{{ store.activeNode.answer }}</p>
        </div>

        <!-- Sub-questions shown inline -->
        <div
          v-for="sub in store.activeNode.subQuestions"
          :key="sub.id"
          class="border-t border-border pt-3"
        >
          <p class="text-xs font-medium text-foreground mb-1">{{ sub.question }}</p>
          <p v-if="sub.loading" class="text-xs text-muted-foreground animate-pulse">Thinking...</p>
          <p v-else class="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {{ sub.answer }}
          </p>
        </div>
      </div>
    </ScrollArea>

    <!-- Input bar at bottom -->
    <div class="shrink-0 border-t border-border px-4 py-3">
      <form class="flex gap-2" @submit.prevent="submit(false)">
        <Input
          v-model="question"
          placeholder="Ask a question..."
          autofocus
          class="flex-1 h-8 text-sm"
          @keydown="handleKeydown"
        />
        <Button type="submit" size="sm">Ask</Button>
      </form>
      <p class="text-[10px] text-muted-foreground mt-1.5 text-center">
        <kbd class="px-1 py-0.5 rounded bg-muted font-mono">Enter</kbd> to ask
        &middot;
        <kbd class="px-1 py-0.5 rounded bg-muted font-mono">Shift+Enter</kbd> to ask and expand
      </p>
    </div>
  </div>
</template>
