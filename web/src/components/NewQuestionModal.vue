<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { askMainQuestion, askSubQuestion } from '@/services/ai'

const store = useExplorationStore()
const question = ref('')
const loading = ref(false)

function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && !loading.value) {
    store.cancelNewQuestion()
  }
}

onMounted(() => window.addEventListener('keydown', handleEsc))
onUnmounted(() => window.removeEventListener('keydown', handleEsc))

/** The root anchor created in this session */
const rootAnchorId = ref<string | null>(null)

/** All Q&A pairs shown in this session */
const conversation = ref<{ question: string; answer: string; isRoot: boolean }[]>([])

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault()
    submitAndExplore()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    submit()
  }
}

async function submit() {
  const q = question.value.trim()
  if (!q || loading.value) return

  loading.value = true
  question.value = ''

  try {
    if (!rootAnchorId.value) {
      // First question — create a new top-level anchor
      const answer = await askMainQuestion(q)
      const node = store.addAnchorNode(q, answer)
      rootAnchorId.value = node.id
      conversation.value.push({ question: q, answer, isRoot: true })
    } else {
      // Follow-up — treat as sub-question, auto-promote to child anchor
      const rootNode = store.nodes.get(rootAnchorId.value)
      if (!rootNode) return
      const ancestors = store.getAncestorChain(rootNode.id)
      const answer = await askSubQuestion(ancestors, q)
      store.addAnchorNode(q, answer, rootAnchorId.value)
      conversation.value.push({ question: q, answer, isRoot: false })
    }
  } catch (err) {
    console.error('AI request failed:', err)
  } finally {
    loading.value = false
  }
}

async function submitAndExplore() {
  const q = question.value.trim()
  if (q && !loading.value) {
    await submit()
  }
  // Transition to anchored view if we have an anchor
  if (store.activeNode) {
    store.transitionToAnchored()
  }
}

function explore() {
  if (store.activeNode) {
    store.transitionToAnchored()
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col">
    <!-- Content area -->
    <ScrollArea class="flex-1 min-h-0">
      <!-- Before asking: empty state -->
      <div
        v-if="conversation.length === 0 && !loading"
        class="h-full flex flex-col items-center justify-center px-8 py-16 text-center"
      >
        <h2 class="text-lg font-semibold text-foreground mb-2">Start Exploring</h2>
        <p class="text-xs text-muted-foreground max-w-sm">
          Type a question below and press
          <kbd class="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd>
          to ask.
        </p>
      </div>

      <!-- Loading (first question) -->
      <div
        v-else-if="loading && conversation.length === 0"
        class="h-full flex items-center justify-center px-8 py-16"
      >
        <p class="text-sm text-muted-foreground animate-pulse">Thinking...</p>
      </div>

      <!-- Conversation thread -->
      <div v-else class="px-6 py-5 space-y-4">
        <div
          v-for="(entry, i) in conversation"
          :key="i"
          :class="i > 0 ? 'border-t border-border pt-4' : ''"
        >
          <p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            {{ entry.isRoot ? 'Question' : 'Follow-up' }}
          </p>
          <p class="text-sm font-medium mb-2">{{ entry.question }}</p>
          <p class="text-sm leading-relaxed whitespace-pre-wrap">{{ entry.answer }}</p>
        </div>

        <!-- Loading indicator for follow-up -->
        <div v-if="loading" class="border-t border-border pt-4">
          <p class="text-sm text-muted-foreground animate-pulse">Thinking...</p>
        </div>

        <!-- Explore button -->
        <div v-if="!loading && conversation.length > 0" class="pt-2">
          <Button size="sm" class="text-xs" @click="explore">
            Explore this answer
          </Button>
        </div>
      </div>
    </ScrollArea>

    <!-- Input bar at bottom -->
    <div class="shrink-0 border-t border-border px-4 py-3">
      <form class="flex gap-2" @submit.prevent="submit">
        <Input
          v-model="question"
          :placeholder="loading ? 'Thinking...' : (conversation.length === 0 ? 'Ask a question...' : 'Ask a follow-up...')"
          :disabled="loading"
          autofocus
          class="flex-1 h-8 text-sm"
          @keydown="handleKeydown"
        />
        <Button type="submit" size="sm" :disabled="loading">Ask</Button>
      </form>
      <p class="text-[10px] text-muted-foreground mt-1.5 text-center">
        <kbd class="px-1 py-0.5 rounded bg-muted font-mono">Enter</kbd> to ask
        &middot;
        <kbd class="px-1 py-0.5 rounded bg-muted font-mono">Shift+Enter</kbd> to ask and explore
      </p>
    </div>
  </div>
</template>
