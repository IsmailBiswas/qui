<script setup lang="ts">
import { computed } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import NewQuestionModal from '@/components/NewQuestionModal.vue'
import HistoryModal from '@/components/HistoryModal.vue'

const store = useExplorationStore()

const hasHistory = computed(() => store.allNodes.some((n) => n.parentId === null))

/**
 * Show new-question view when:
 * - store.showNewQuestionView is true (Shift+Space was pressed), OR
 * - there are no saved questions at all
 */
const showNew = computed(() => store.showNewQuestionView || !hasHistory.value)
</script>

<template>
  <NewQuestionModal v-if="showNew" />
  <HistoryModal v-else />
</template>
