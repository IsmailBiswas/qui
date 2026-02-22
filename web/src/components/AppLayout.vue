<script setup lang="ts">
import GraphView from '@/components/GraphView.vue'
import ExplanationPanel from '@/components/ExplanationPanel.vue'
import ThreadList from '@/components/ThreadList.vue'
import InputOverlay from '@/components/InputOverlay.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useExplorationStore } from '@/stores/exploration'

const store = useExplorationStore()
</script>

<template>
  <div class="h-screen w-screen flex bg-background text-foreground overflow-hidden">
    <!-- Left Section: 30% -->
    <div class="w-[30%] flex flex-col border-r border-border">
      <!-- 3D Graph View: top 20% -->
      <div class="h-[20%] border-b border-border">
        <GraphView />
      </div>
      <!-- Bottom 80%: reserved / empty -->
      <div class="h-[80%]" />
    </div>

    <!-- Middle Section: 50% -->
    <div class="w-[50%] flex flex-col border-r border-border">
      <ExplanationPanel v-if="store.activeNode" />
      <EmptyState v-else />
    </div>

    <!-- Right Section: 20% -->
    <div class="w-[20%] flex flex-col">
      <ThreadList />
    </div>

    <!-- Input Overlay (hidden by default, shown on keyboard shortcut) -->
    <InputOverlay />
  </div>
</template>
