<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { askMainQuestion, askSubQuestion } from '@/services/ai'

const store = useExplorationStore()
const question = ref('')
const loading = ref(false)
const inputRef = ref<InstanceType<typeof Input> | null>(null)

function focusInput() {
  nextTick(() => {
    const el = inputRef.value?.$el?.querySelector('input') ?? inputRef.value?.$el
    el?.focus()
  })
}

function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && !loading.value) {
    store.cancelNewQuestion()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEsc)
  focusInput()
})
onUnmounted(() => window.removeEventListener('keydown', handleEsc))

/** The root anchor created in this session */
const rootAnchorId = ref<string | null>(null)

/** All Q&A pairs shown in this session */
const conversation = ref<{ question: string; answer: string; isRoot: boolean }[]>([])

// ── Explore strip animation ───────────────────────────────────────────────────
// Phases:
//   idle        → off-screen to the right (element stays in DOM)
//   width       → slides in at thin height
//   height      → expands from center to fill answer section
//   ready       → "Explore this answer" text fades in
type ExplorePhase = 'idle' | 'width' | 'height' | 'ready'
const explorePhase = ref<ExplorePhase>('idle')
/** Once the strip has fully appeared, it never hides again this session */
const exploredOnce = ref(false)
let exploreTimer: ReturnType<typeof setTimeout> | null = null

function triggerExploreAnimation() {
  // Never re-trigger once already shown
  if (exploredOnce.value) return
  if (explorePhase.value !== 'idle') return
  exploreTimer = setTimeout(() => {
    explorePhase.value = 'width'            // slide in from right
    setTimeout(() => {
      explorePhase.value = 'height'         // scaleY expand from center
      setTimeout(() => {
        explorePhase.value = 'ready'        // reveal text
        exploredOnce.value = true           // lock — never hide again
      }, 500)
    }, 600)
  }, 3000)
}

function resetExplore() {
  // Cancel a pending timer only — don't hide the strip once it's visible
  if (exploreTimer) { clearTimeout(exploreTimer); exploreTimer = null }
  if (!exploredOnce.value) explorePhase.value = 'idle'
}

watch(loading, (val) => {
  if (!val && conversation.value.length > 0 && !exploredOnce.value) {
    triggerExploreAnimation()
  }
})

// ─────────────────────────────────────────────────────────────────────────────

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
  // Only cancel a pending timer; never hide the strip once it's been shown
  if (!exploredOnce.value) resetExplore()

  try {
    if (!rootAnchorId.value) {
      const answer = await askMainQuestion(q)
      const node = store.addAnchorNode(q, answer)
      rootAnchorId.value = node.id
      conversation.value.push({ question: q, answer, isRoot: true })
    } else {
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
  <div class="h-full w-full flex flex-col overflow-hidden">
    <!-- Answer section + strip share this parent so the strip height matches exactly -->
    <div class="flex-1 min-h-0 relative flex">
      <!-- Content area -->
      <ScrollArea
        class="flex-1 min-h-0 transition-[margin] duration-[550ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        :class="explorePhase !== 'idle' ? 'mr-[8%]' : 'mr-0'"
      >
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
      </div>
      </ScrollArea>

      <!--
        Explore strip — always in DOM so CSS transition works from the start.
        Idle = off-screen right (translateX 100%). Phase classes slide + expand it.
      -->
      <div
        class="explore-strip absolute right-0 top-0 h-full bg-yellow-400 flex items-center justify-center cursor-pointer overflow-hidden"
        :class="{
          'strip-idle':   explorePhase === 'idle',
          'strip-width':  explorePhase === 'width',
          'strip-height': explorePhase === 'height',
          'strip-ready':  explorePhase === 'ready',
        }"
        @click="explore"
      >
        <span
          class="select-none font-normal text-[32px] tracking-widest uppercase text-yellow-900 whitespace-nowrap"
          :class="explorePhase === 'ready' ? 'opacity-100' : 'opacity-0'"
          style="transform: rotate(90deg); transition: opacity 0.4s ease 0.15s"
        >
          Explore this answer
        </span>
      </div>
    </div>

    <!-- Input bar at bottom -->
    <div class="shrink-0 border-t border-border px-4 py-3">
      <form class="flex gap-2" @submit.prevent="submit">
        <Input
          ref="inputRef"
          v-model="question"
          :placeholder="loading ? 'Thinking...' : (conversation.length === 0 ? 'Ask a question...' : 'Ask a follow-up...')"
          :disabled="loading"
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

<style scoped>
/* ── Explore strip states ─────────────────────────────────────────────────── */

.explore-strip {
  /*
    Always in DOM. Default state = fully off-screen to the right, vertically tiny.
    Both transitions defined here so they apply regardless of which class is active.
    transform-origin: center → scaleY grows symmetrically top + bottom.
  */
  width: 8%;
  pointer-events: none;
  transform: translateX(100%) scaleY(0.04);
  transform-origin: center;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Explicitly off-screen — pointer events off */
.strip-idle {
  transform: translateX(100%) scaleY(0.04);
  pointer-events: none;
}

/* 1. Slide in from right, still thin */
.strip-width {
  transform: translateX(0%) scaleY(0.04);
  pointer-events: none;
}

/* 2. Expand from center outward */
.strip-height {
  transform: translateX(0%) scaleY(1);
  transition: transform 0.5s cubic-bezier(0.34, 1.15, 0.64, 1);
  pointer-events: none;
}

/* 3. Ready — fully visible, clickable */
.strip-ready {
  transform: translateX(0%) scaleY(1);
  pointer-events: auto;
}
</style>
