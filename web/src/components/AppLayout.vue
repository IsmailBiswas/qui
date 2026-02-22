<script setup lang="ts">
import GraphView from '@/components/GraphView.vue'
import ExplanationPanel from '@/components/ExplanationPanel.vue'
import ThreadList from '@/components/ThreadList.vue'
import MainModal from '@/components/MainModal.vue'
import FloatingInput from '@/components/FloatingInput.vue'
import { useExplorationStore } from '@/stores/exploration'
import { computed, onMounted, onUnmounted } from 'vue'

const store = useExplorationStore()
const isAnchored = computed(() => store.viewMode === 'anchored')

function handleGlobalKeydown(e: KeyboardEvent) {
  const tag = (document.activeElement as HTMLElement)?.tagName
  const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable
  if (isEditable) return

  // Shift+Space to start a fresh new question (keeps saved data)
  if (e.key === ' ' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    store.startNewQuestion()
  }

  // Shift+H to show history modal
  if (e.key === 'H' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    store.showHistoryModal()
  }
}

onMounted(() => window.addEventListener('keydown', handleGlobalKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleGlobalKeydown))
</script>

<template>
  <div class="h-screen w-screen bg-background text-foreground overflow-hidden relative">
    <!--
      Modal mode: centered 80% modal with Q&A + input.
      Anchored mode: 3-column layout.
      The modal smoothly resizes/moves into the middle section.
    -->

    <!-- Backdrop (modal mode only) -->
    <Transition name="fade">
      <div
        v-if="!isAnchored"
        class="absolute inset-0 bg-black/60 z-10"
      />
    </Transition>

    <!-- Graph View: top-left 20% height (slides down from top) -->
    <Transition name="slide-down">
      <div
        v-if="isAnchored"
        class="absolute top-0 left-0 w-[30%] h-[30%] border-r border-b border-border z-0"
      >
        <GraphView :root-node-id="store.activeNodeId" />
      </div>
    </Transition>

    <!-- Middle section: Explanation / Answer (fades in) -->
    <Transition name="fade-slide">
      <div
        v-if="isAnchored"
        class="absolute top-0 left-[30%] w-[50%] h-full border-r border-border z-0"
      >
        <ExplanationPanel />
      </div>
    </Transition>

    <!-- Right section: Thread List (slides in from right) -->
    <Transition name="slide-right">
      <div
        v-if="isAnchored"
        class="absolute top-0 right-0 h-full w-[20%] flex flex-col border-l border-border z-0"
      >
        <ThreadList />
      </div>
    </Transition>

    <!-- Main panel: morphs from centered 80% modal → left-bottom anchor section -->
    <div
      class="absolute z-20 flex flex-col rounded-lg border border-border bg-card shadow-2xl overflow-hidden transition-all duration-500 ease-in-out"
      :class="isAnchored
        ? 'top-[30%] left-0 w-[30%] h-[70%] rounded-none shadow-none border-r'
        : 'top-[10%] left-[10%] w-[80%] h-[80%]'"
    >
      <MainModal v-if="!isAnchored" />
      <!-- In anchored mode: show the anchor question + answer -->
      <div v-else class="h-full flex flex-col overflow-auto">
        <div class="px-4 py-3 border-b border-border shrink-0">
          <p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Anchor</p>
          <p v-if="store.activeNode" class="text-sm font-medium">{{ store.activeNode.question }}</p>
        </div>
        <div v-if="store.activeNode" class="px-4 py-3 flex-1 overflow-auto">
          <p class="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{{ store.activeNode.answer }}</p>
        </div>
      </div>
    </div>

    <!-- Floating draggable input (Ctrl+I) -->
    <FloatingInput />
  </div>
</template>

<style scoped>
/* Backdrop fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Graph view slide down */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* Middle section fade+slide */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* Right section slide */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
