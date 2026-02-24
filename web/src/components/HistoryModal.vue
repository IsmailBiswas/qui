<script setup lang="ts">
import { nextTick, computed, ref, onMounted, onUnmounted } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import { ScrollArea } from '@/components/ui/scroll-area'
import GraphView from '@/components/GraphView.vue'
import ModalQuestionItem from '@/components/ModalQuestionItem.vue'

const store = useExplorationStore()
const historyGraphExpanded = ref(false)
const previewContainerRef = ref<HTMLElement | null>(null)

// Captured rect of the preview pane at the moment expand is triggered
const fromRect = ref<DOMRect | null>(null)

const rootNodes = computed(() =>
  store.allNodes.filter((n) => n.parentId === null)
)

function selectQuestion(nodeId: string) {
  store.selectNode(nodeId)
}

function exploreQuestion(nodeId: string) {
  store.selectNode(nodeId)
  nextTick(() => store.transitionToAnchored())
}

function deleteQuestion(nodeId: string) {
  store.deleteNode(nodeId)
}

function expandGraph() {
  fromRect.value = previewContainerRef.value?.getBoundingClientRect() ?? null
  historyGraphExpanded.value = true
}

// JS transition hooks — grow FROM the preview rect, shrink BACK to it
function onBeforeEnter(el: Element) {
  const r = fromRect.value
  const div = el as HTMLElement
  if (!r) return
  div.style.transition = 'none'
  div.style.top    = `${r.top}px`
  div.style.left   = `${r.left}px`
  div.style.width  = `${r.width}px`
  div.style.height = `${r.height}px`
  div.style.borderRadius = '0px'
}

function onEnter(el: Element, done: () => void) {
  const div = el as HTMLElement
  // Force reflow so the initial styles are painted before we start animating
  div.getBoundingClientRect()
  div.style.transition = 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease'
  div.style.top    = '0px'
  div.style.left   = '0px'
  div.style.width  = '100vw'
  div.style.height = '100vh'
  div.addEventListener('transitionend', done, { once: true })
}

function onLeave(el: Element, done: () => void) {
  const r = fromRect.value
  const div = el as HTMLElement
  div.style.transition = 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease'
  if (r) {
    div.style.top    = `${r.top}px`
    div.style.left   = `${r.left}px`
    div.style.width  = `${r.width}px`
    div.style.height = `${r.height}px`
  } else {
    div.style.opacity = '0'
  }
  div.addEventListener('transitionend', done, { once: true })
}

// Node clicked while graph is in the full-screen overlay → go to anchored view
function onGraphNodeSelected() {
  historyGraphExpanded.value = false
  if (store.activeNodeId) exploreQuestion(store.activeNodeId)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && historyGraphExpanded.value) {
    historyGraphExpanded.value = false
    return
  }
  if (e.key === 'V' && e.shiftKey && !e.ctrlKey && !e.metaKey && store.activeNode) {
    e.preventDefault()
    if (historyGraphExpanded.value) {
      historyGraphExpanded.value = false
    } else {
      expandGraph()
    }
    return
  }
  if (e.key === 'Escape' && store.previousViewMode === 'anchored') {
    store.cancelNewQuestion()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="h-full w-full flex">
    <!-- Left: saved questions list -->
    <div class="w-[55%] flex flex-col border-r border-border">
      <div class="px-4 py-2 border-b border-border shrink-0">
        <p class="text-[10px] text-muted-foreground uppercase tracking-wide">Saved Questions</p>
      </div>
      <ScrollArea class="flex-1 min-h-0">
        <div class="px-[11px]">
          <ModalQuestionItem
            v-for="node in rootNodes"
            :key="node.id"
            :node="node"
            :is-active="store.activeNodeId === node.id"
            @select="selectQuestion(node.id)"
            @explore="exploreQuestion(node.id)"
            @delete="deleteQuestion(node.id)"
          />
        </div>
      </ScrollArea>
    </div>

    <!-- Right: 3D graph preview (inline) -->
    <div class="w-[45%] h-full flex flex-col min-h-0">
      <div class="px-4 py-2 border-b border-border shrink-0">
        <p class="text-[10px] text-muted-foreground uppercase tracking-wide">Graph Preview</p>
      </div>
      <div ref="previewContainerRef" class="flex-1 min-h-0 relative">
        <GraphView
          v-if="store.activeNode"
          :root-node-id="store.activeRootNodeId"
          :expanded="false"
          @toggle-expand="expandGraph"
          @node-selected="onGraphNodeSelected"
        />
        <div v-else class="h-full flex items-center justify-center">
          <p class="text-xs text-muted-foreground">Select a question to preview</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Full-screen graph overlay: grows from the preview pane position -->
  <Teleport to="body">
    <Transition
      :css="false"
      @before-enter="onBeforeEnter"
      @enter="onEnter"
      @leave="onLeave"
    >
      <div
        v-if="historyGraphExpanded && store.activeNode"
        class="fixed z-[200] bg-card overflow-hidden"
      >
        <GraphView
          :root-node-id="store.activeRootNodeId"
          :expanded="true"
          @toggle-expand="historyGraphExpanded = false"
          @node-selected="onGraphNodeSelected"
        />
      </div>
    </Transition>
  </Teleport>
</template>
