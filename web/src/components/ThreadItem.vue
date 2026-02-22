<script setup lang="ts">
import { ref } from 'vue'
import { useExplorationStore } from '@/stores/exploration'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import type { SubQuestion } from '@/types'

const props = defineProps<{
  subQuestion: SubQuestion
}>()

const store = useExplorationStore()
const open = ref(false)

function promote() {
  store.promoteSubQuestion(props.subQuestion.anchorId, props.subQuestion.id)
}
</script>

<template>
  <Collapsible v-model:open="open" class="border-b border-border">
    <CollapsibleTrigger class="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors">
      <div class="flex items-start gap-2">
        <span class="text-[10px] text-muted-foreground mt-0.5">{{ open ? '▾' : '▸' }}</span>
        <span class="text-xs font-medium leading-snug">{{ subQuestion.question }}</span>
      </div>
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div class="px-4 pb-3 pl-8">
        <div v-if="subQuestion.loading" class="text-xs text-muted-foreground animate-pulse">
          Thinking...
        </div>
        <div v-else>
          <p class="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {{ subQuestion.answer }}
          </p>
          <Button variant="outline" size="sm" class="mt-2 text-[10px] h-6" @click="promote">
            Promote to Anchor
          </Button>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
