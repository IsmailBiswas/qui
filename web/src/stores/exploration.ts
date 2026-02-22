import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AnchorNode, SubQuestion } from '@/types'

export const useExplorationStore = defineStore('exploration', () => {
  const nodes = ref<Map<string, AnchorNode>>(new Map())
  const activeNodeId = ref<string | null>(null)
  const selectedSubQuestionId = ref<string | null>(null)
  const inputVisible = ref(false)
  const inputMode = ref<'main' | 'sub'>('main')
  /** 'modal' = big centered modal on homepage, 'anchored' = 3-column layout */
  const viewMode = ref<'modal' | 'anchored'>('modal')

  const activeNode = computed(() => {
    if (!activeNodeId.value) return null
    return nodes.value.get(activeNodeId.value) ?? null
  })

  const rootNode = computed(() => {
    for (const node of nodes.value.values()) {
      if (node.parentId === null) return node
    }
    return null
  })

  const allNodes = computed(() => Array.from(nodes.value.values()))

  const selectedSubQuestion = computed(() => {
    if (!activeNodeId.value || !selectedSubQuestionId.value) return null
    const node = nodes.value.get(activeNodeId.value)
    if (!node) return null
    return node.subQuestions.find((s) => s.id === selectedSubQuestionId.value) ?? null
  })

  function selectSubQuestion(subId: string | null) {
    selectedSubQuestionId.value = subId
  }

  function generateId(): string {
    return crypto.randomUUID()
  }

  function showInput(mode: 'main' | 'sub' = 'main') {
    inputMode.value = mode
    inputVisible.value = true
  }

  function hideInput() {
    inputVisible.value = false
  }

  function addAnchorNode(question: string, answer: string, parentId: string | null = null): AnchorNode {
    const id = generateId()
    const node: AnchorNode = {
      id,
      question,
      answer,
      parentId,
      childIds: [],
      subQuestions: [],
    }
    nodes.value.set(id, node)

    if (parentId) {
      const parent = nodes.value.get(parentId)
      if (parent) {
        parent.childIds.push(id)
      }
    }

    activeNodeId.value = id
    return node
  }

  function addSubQuestion(anchorId: string, question: string): SubQuestion {
    const node = nodes.value.get(anchorId)
    if (!node) throw new Error(`Node ${anchorId} not found`)

    const sub: SubQuestion = {
      id: generateId(),
      anchorId,
      question,
      answer: '',
      loading: true,
    }
    node.subQuestions.push(sub)
    selectedSubQuestionId.value = sub.id
    return sub
  }

  function updateSubQuestionAnswer(anchorId: string, subId: string, answer: string) {
    const node = nodes.value.get(anchorId)
    if (!node) return
    const sub = node.subQuestions.find((s) => s.id === subId)
    if (sub) {
      sub.answer = answer
      sub.loading = false
    }
  }

  function promoteSubQuestion(anchorId: string, subId: string): AnchorNode | null {
    const node = nodes.value.get(anchorId)
    if (!node) return null
    const sub = node.subQuestions.find((s) => s.id === subId)
    if (!sub || !sub.answer) return null

    return addAnchorNode(sub.question, sub.answer, anchorId)
  }

  function selectNode(nodeId: string) {
    if (nodes.value.has(nodeId)) {
      activeNodeId.value = nodeId
      selectedSubQuestionId.value = null
    }
  }

  function transitionToAnchored() {
    viewMode.value = 'anchored'
  }

  function reset() {
    nodes.value.clear()
    activeNodeId.value = null
    selectedSubQuestionId.value = null
    inputVisible.value = false
    inputMode.value = 'main'
    viewMode.value = 'modal'
  }

  return {
    nodes,
    activeNodeId,
    selectedSubQuestionId,
    inputVisible,
    inputMode,
    viewMode,
    activeNode,
    rootNode,
    allNodes,
    selectedSubQuestion,
    showInput,
    hideInput,
    addAnchorNode,
    addSubQuestion,
    updateSubQuestionAnswer,
    promoteSubQuestion,
    selectNode,
    selectSubQuestion,
    transitionToAnchored,
    reset,
  }
})
