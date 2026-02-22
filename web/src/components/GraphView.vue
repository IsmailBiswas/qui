<script setup lang="ts">
import { useExplorationStore } from '@/stores/exploration'
import { computed } from 'vue'

const store = useExplorationStore()

const nodes = computed(() => store.allNodes)
const activeId = computed(() => store.activeNodeId)

function handleNodeClick(nodeId: string) {
  store.selectNode(nodeId)
}
</script>

<template>
  <div class="h-full w-full bg-muted/30 flex items-center justify-center relative overflow-hidden">
    <div v-if="nodes.length === 0" class="text-muted-foreground text-xs">
      No nodes yet
    </div>

    <!-- Simple 2D placeholder for 3D graph — replace with Three.js later -->
    <svg v-else class="w-full h-full" viewBox="0 0 400 200">
      <!-- Edges -->
      <line
        v-for="node in nodes.filter((n) => n.parentId)"
        :key="'edge-' + node.id"
        :x1="getNodeX(node.parentId!, nodes)"
        :y1="getNodeY(node.parentId!, nodes)"
        :x2="getNodeX(node.id, nodes)"
        :y2="getNodeY(node.id, nodes)"
        stroke="currentColor"
        class="text-border"
        stroke-width="1"
      />
      <!-- Nodes -->
      <g
        v-for="(node, i) in nodes"
        :key="node.id"
        class="cursor-pointer"
        @click="handleNodeClick(node.id)"
      >
        <circle
          :cx="getNodeX(node.id, nodes)"
          :cy="getNodeY(node.id, nodes)"
          r="12"
          :class="node.id === activeId ? 'fill-primary' : 'fill-muted-foreground/40'"
          stroke="currentColor"
          class="text-border"
          stroke-width="1"
        />
        <text
          :x="getNodeX(node.id, nodes)"
          :y="getNodeY(node.id, nodes) + 4"
          text-anchor="middle"
          class="fill-primary-foreground text-[8px] pointer-events-none"
        >
          {{ i + 1 }}
        </text>
      </g>
    </svg>
  </div>
</template>

<script lang="ts">
import type { AnchorNode } from '@/types'

function getNodeIndex(nodeId: string, nodes: AnchorNode[]): number {
  return nodes.findIndex((n) => n.id === nodeId)
}

function getNodeX(nodeId: string, nodes: AnchorNode[]): number {
  const idx = getNodeIndex(nodeId, nodes)
  const count = nodes.length
  if (count <= 1) return 200
  return 40 + (idx * 320) / (count - 1)
}

function getNodeY(nodeId: string, nodes: AnchorNode[]): number {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return 100
  // Root at top, children lower
  let depth = 0
  let current = node
  while (current.parentId) {
    depth++
    current = nodes.find((n) => n.id === current.parentId)!
    if (!current) break
  }
  return 30 + depth * 50
}
</script>
