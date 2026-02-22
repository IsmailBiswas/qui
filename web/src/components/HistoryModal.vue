<script setup lang="ts">
import { nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import { ScrollArea } from '@/components/ui/scroll-area'
import GraphView from '@/components/GraphView.vue'
import ModalQuestionItem from '@/components/ModalQuestionItem.vue'

const store = useExplorationStore()

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

function handleKeydown(e: KeyboardEvent) {
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
      <ScrollArea class="flex-1">
        <ModalQuestionItem
          v-for="node in rootNodes"
          :key="node.id"
          :node="node"
          :is-active="store.activeNodeId === node.id"
          @select="selectQuestion(node.id)"
          @explore="exploreQuestion(node.id)"
        />
      </ScrollArea>
    </div>

    <!-- Right: 3D graph preview -->
    <div class="w-[45%] flex flex-col">
      <div class="px-4 py-2 border-b border-border shrink-0">
        <p class="text-[10px] text-muted-foreground uppercase tracking-wide">Graph Preview</p>
      </div>
      <div class="flex-1 min-h-0 relative">
        <GraphView v-if="store.activeNode" :root-node-id="store.activeNodeId" />
        <div v-else class="h-full flex items-center justify-center">
          <p class="text-xs text-muted-foreground">Select a question to preview</p>
        </div>
      </div>
    </div>
  </div>
</template>
