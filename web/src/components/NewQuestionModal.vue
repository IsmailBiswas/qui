<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { streamMainQuestion, streamSubQuestion } from '@/services/ai'
import MarkdownContent from '@/components/MarkdownContent.vue'

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
  }, 2000)
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

  // Push placeholder entry immediately so the question appears in the UI
  conversation.value.push({ question: q, answer: '', isRoot: !rootAnchorId.value })
  const idx = conversation.value.length - 1

  try {
    if (!rootAnchorId.value) {
      const node = store.addAnchorNode(q, '')
      rootAnchorId.value = node.id
      for await (const chunk of streamMainQuestion(q)) {
        conversation.value[idx]!.answer += chunk
        store.appendNodeAnswer(node.id, chunk)
      }
      store.finishNodeAnswer(node.id)
    } else {
      const parentId = store.activeNodeId ?? rootAnchorId.value
      const ancestors = store.getAncestorChain(parentId)
      const node = store.addAnchorNode(q, '', parentId)
      for await (const chunk of streamSubQuestion(ancestors, q)) {
        conversation.value[idx]!.answer += chunk
        store.appendNodeAnswer(node.id, chunk)
      }
      store.finishNodeAnswer(node.id)
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
        <h2 class="text-lg font-semibold text-foreground mb-4">Start Exploring</h2>
        <div class="flex flex-col gap-2 text-xs text-muted-foreground">
          <div class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Enter</kbd>
            <span>show answer here</span>
          </div>
          <div class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Shift+Enter</kbd>
            <span>open answer in main view</span>
          </div>
        </div>
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
          <MarkdownContent :content="entry.answer" />
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
