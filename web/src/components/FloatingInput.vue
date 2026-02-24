<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { streamMainQuestion, streamSubQuestion } from '@/services/ai'

const store = useExplorationStore()

const visible = ref(false)
const question = ref('')
const loading = ref(false)
const pos = ref({ x: 0, y: 0 })
const dragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const panelRef = ref<HTMLElement | null>(null)
const inputRef = ref<InstanceType<typeof Input> | null>(null)

function centerPanel() {
  pos.value = {
    x: Math.round(window.innerWidth / 2 - 200),
    y: Math.round(window.innerHeight / 2 - 40),
  }
}

function toggle() {
  visible.value = !visible.value
  if (visible.value) {
    centerPanel()
    question.value = ''
    nextTick(() => {
      const el = panelRef.value?.querySelector('input')
      el?.focus()
    })
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  // Space to open floating input (only when anchored, has active node, no input focused)
  if (
    e.key === ' ' &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    store.viewMode === 'anchored' &&
    store.activeNode &&
    !visible.value
  ) {
    const tag = (document.activeElement as HTMLElement)?.tagName
    const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable
    if (!isEditable) {
      e.preventDefault()
      toggle()
    }
  }
  if (e.key === 'Escape' && visible.value) {
    visible.value = false
  }
}

// Drag handlers
function onMouseDown(e: MouseEvent) {
  dragging.value = true
  dragOffset.value = {
    x: e.clientX - pos.value.x,
    y: e.clientY - pos.value.y,
  }
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.value) return
  pos.value = {
    x: e.clientX - dragOffset.value.x,
    y: e.clientY - dragOffset.value.y,
  }
}

function onMouseUp() {
  dragging.value = false
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

async function submit() {
  const q = question.value.trim()
  if (!q || loading.value) return

  loading.value = true
  question.value = ''
  visible.value = false

  try {
    if (!store.activeNode) {
      const node = store.addAnchorNode(q, '')
      for await (const chunk of streamMainQuestion(q)) {
        store.appendNodeAnswer(node.id, chunk)
      }
      store.finishNodeAnswer(node.id)
    } else {
      const anchorId = store.activeNode.id
      const sub = store.addSubQuestion(anchorId, q)
      const ancestors = store.getAncestorChain(anchorId)
      for await (const chunk of streamSubQuestion(ancestors, q)) {
        store.appendSubQuestionAnswer(sub.anchorId, sub.id, chunk)
      }
      store.finishSubQuestionAnswer(sub.anchorId, sub.id)
    }
  } catch (err) {
    console.error('AI request failed:', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="panelRef"
      class="fixed z-50 rounded-lg border border-border bg-card shadow-xl"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
    >
      <!-- Drag handle -->
      <div
        class="flex items-center justify-between px-3 py-1.5 border-b border-border cursor-move select-none"
        @mousedown="onMouseDown"
      >
        <span class="text-[10px] text-muted-foreground uppercase tracking-wide">Ask</span>
        <button
          class="text-muted-foreground hover:text-foreground text-xs leading-none px-1"
          @click="visible = false"
        >
          x
        </button>
      </div>

      <!-- Input -->
      <form class="flex gap-1.5 p-2" @submit.prevent="submit">
        <Input
          ref="inputRef"
          v-model="question"
          placeholder="Ask a question..."
          class="w-72 h-7 text-xs"
        />
        <Button type="submit" size="sm" class="h-7 text-xs">Go</Button>
      </form>
    </div>
  </Teleport>
</template>
