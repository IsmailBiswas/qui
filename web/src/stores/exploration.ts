import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { AnchorNode, SubQuestion } from '@/types'

const STORAGE_KEY = 'stop-it-bro-exploration'
const SESSION_VIEW_KEY = 'stop-it-bro-view-mode'

interface PersistedState {
  nodes: [string, AnchorNode][]
  activeNodeId: string | null
  selectedSubQuestionId: string | null
  viewMode: 'modal' | 'anchored'
}

function loadFromStorage(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

function saveToStorage(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // silently ignore quota errors
  }
}

export const useExplorationStore = defineStore('exploration', () => {
  const saved = loadFromStorage()

  const nodes = ref<Map<string, AnchorNode>>(
    saved ? new Map(saved.nodes) : new Map()
  )
  const activeNodeId = ref<string | null>(saved?.activeNodeId ?? null)
  const selectedSubQuestionId = ref<string | null>(saved?.selectedSubQuestionId ?? null)
  const inputVisible = ref(false)
  const inputMode = ref<'main' | 'sub'>('main')
  /** 'modal' = big centered modal on homepage, 'anchored' = 3-column layout */
  // sessionStorage survives soft refresh but clears on hard refresh / new tab
  const sessionView = sessionStorage.getItem(SESSION_VIEW_KEY) as 'modal' | 'anchored' | null
  const viewMode = ref<'modal' | 'anchored'>(
    sessionView === 'anchored' && saved?.activeNodeId ? 'anchored' : 'modal'
  )
  /** When true, MainModal shows the new-question input instead of history.
   *  Initialized to true when there is no saved history (first-time user). */
  const showNewQuestionView = ref(!saved || saved.nodes.length === 0)
  /** Tracks where the user was before pressing Shift+Space */
  const previousViewMode = ref<'modal' | 'anchored' | null>(null)
  const previousActiveNodeId = ref<string | null>(null)
  const previousSelectedSubQuestionId = ref<string | null>(null)

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

  /** Walk up from activeNodeId to find the top-level root ancestor */
  const activeRootNodeId = computed<string | null>(() => {
    if (!activeNodeId.value) return null
    let cur = nodes.value.get(activeNodeId.value)
    if (!cur) return null
    while (cur.parentId) {
      const parent = nodes.value.get(cur.parentId)
      if (!parent) break
      cur = parent
    }
    return cur.id
  })

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
      loading: answer === '',
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

  // ── Streaming helpers ──────────────────────────────────────────────────────

  function appendNodeAnswer(nodeId: string, chunk: string) {
    const node = nodes.value.get(nodeId)
    if (node) node.answer += chunk
  }

  function appendSubQuestionAnswer(anchorId: string, subId: string, chunk: string) {
    const node = nodes.value.get(anchorId)
    const sub = node?.subQuestions.find((s) => s.id === subId)
    if (sub) sub.answer += chunk
  }

  function finishNodeAnswer(nodeId: string) {
    const node = nodes.value.get(nodeId)
    if (node) node.loading = false
  }

  function finishSubQuestionAnswer(anchorId: string, subId: string) {
    const node = nodes.value.get(anchorId)
    const sub = node?.subQuestions.find((s) => s.id === subId)
    if (sub) sub.loading = false
  }

  // ──────────────────────────────────────────────────────────────────────────

  function promoteSubQuestion(anchorId: string, subId: string): AnchorNode | null {
    const node = nodes.value.get(anchorId)
    if (!node) return null
    const sub = node.subQuestions.find((s) => s.id === subId)
    if (!sub || !sub.answer) return null

    const newNode = addAnchorNode(sub.question, sub.answer, anchorId)
    // Remove the promoted sub-question from the list so it's not shown twice
    node.subQuestions = node.subQuestions.filter((s) => s.id !== subId)
    return newNode
  }

  /**
   * Returns the ancestor chain from the root down to the given node (inclusive),
   * as {question, answer} pairs for AI context.
   */
  function getAncestorChain(nodeId: string): { question: string; answer: string }[] {
    const chain: AnchorNode[] = []
    let cur = nodes.value.get(nodeId)
    while (cur) {
      chain.unshift(cur)
      cur = cur.parentId ? nodes.value.get(cur.parentId) : undefined
    }
    return chain.map((n) => ({ question: n.question, answer: n.answer }))
  }

  function selectNode(nodeId: string) {
    if (nodes.value.has(nodeId)) {
      activeNodeId.value = nodeId
      selectedSubQuestionId.value = null
    }
  }

  function transitionToAnchored() {
    viewMode.value = 'anchored'
    showNewQuestionView.value = false
  }

  /** Switch to modal view showing history (saved questions) */
  function showHistoryModal() {
    previousViewMode.value = viewMode.value
    previousActiveNodeId.value = activeNodeId.value
    previousSelectedSubQuestionId.value = selectedSubQuestionId.value
    viewMode.value = 'modal'
    showNewQuestionView.value = false
  }

  /** Go back to modal with fresh question input, keeping all saved data */
  function startNewQuestion() {
    previousViewMode.value = viewMode.value
    previousActiveNodeId.value = activeNodeId.value
    previousSelectedSubQuestionId.value = selectedSubQuestionId.value
    viewMode.value = 'modal'
    activeNodeId.value = null
    selectedSubQuestionId.value = null
    showNewQuestionView.value = true
  }

  /** Cancel the new-question view and go back to where the user was */
  function cancelNewQuestion() {
    showNewQuestionView.value = false
    // Restore previous active node
    if (previousActiveNodeId.value && nodes.value.has(previousActiveNodeId.value)) {
      activeNodeId.value = previousActiveNodeId.value
      selectedSubQuestionId.value = previousSelectedSubQuestionId.value
    }
    if (previousViewMode.value === 'anchored') {
      viewMode.value = 'anchored'
    } else {
      viewMode.value = 'modal'
    }
    previousViewMode.value = null
    previousActiveNodeId.value = null
    previousSelectedSubQuestionId.value = null
  }

  function deleteSubQuestion(anchorId: string, subId: string) {
    const node = nodes.value.get(anchorId)
    if (!node) return
    node.subQuestions = node.subQuestions.filter((s) => s.id !== subId)
    if (selectedSubQuestionId.value === subId) selectedSubQuestionId.value = null
    saveToStorage({
      nodes: Array.from(nodes.value.entries()),
      activeNodeId: activeNodeId.value,
      selectedSubQuestionId: selectedSubQuestionId.value,
      viewMode: viewMode.value,
    })
  }

  function deleteNode(nodeId: string) {
    // Recursively collect node + all descendants
    const toDelete: string[] = []
    const collect = (id: string) => {
      toDelete.push(id)
      const n = nodes.value.get(id)
      if (n) n.childIds.forEach(collect)
    }
    collect(nodeId)
    // Remove from parent's childIds
    const node = nodes.value.get(nodeId)
    if (node?.parentId) {
      const parent = nodes.value.get(node.parentId)
      if (parent) parent.childIds = parent.childIds.filter((id) => id !== nodeId)
    }
    toDelete.forEach((id) => nodes.value.delete(id))
    if (toDelete.includes(activeNodeId.value ?? '')) {
      activeNodeId.value = null
      selectedSubQuestionId.value = null
    }
    // Force-persist immediately — Map.delete() may not reliably trigger the watcher
    saveToStorage({
      nodes: Array.from(nodes.value.entries()),
      activeNodeId: activeNodeId.value,
      selectedSubQuestionId: selectedSubQuestionId.value,
      viewMode: viewMode.value,
    })
  }

  function reset() {
    nodes.value.clear()
    activeNodeId.value = null
    selectedSubQuestionId.value = null
    inputVisible.value = false
    inputMode.value = 'main'
    viewMode.value = 'modal'
    showNewQuestionView.value = false
    previousViewMode.value = null
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(SESSION_VIEW_KEY)
  }

  // Persist relevant state to localStorage on every change
  watch(
    [nodes, activeNodeId, selectedSubQuestionId, viewMode],
    () => {
      saveToStorage({
        nodes: Array.from(nodes.value.entries()),
        activeNodeId: activeNodeId.value,
        selectedSubQuestionId: selectedSubQuestionId.value,
        viewMode: viewMode.value,
      })
      // Sync viewMode to sessionStorage for soft-refresh persistence
      sessionStorage.setItem(SESSION_VIEW_KEY, viewMode.value)
    },
    { deep: true }
  )

  return {
    nodes,
    activeNodeId,
    selectedSubQuestionId,
    inputVisible,
    inputMode,
    viewMode,
    showNewQuestionView,
    previousViewMode,
    activeNode,
    rootNode,
    allNodes,
    activeRootNodeId,
    selectedSubQuestion,
    showInput,
    hideInput,
    addAnchorNode,
    addSubQuestion,
    appendNodeAnswer,
    appendSubQuestionAnswer,
    finishNodeAnswer,
    finishSubQuestionAnswer,
    updateSubQuestionAnswer,
    promoteSubQuestion,
    selectNode,
    selectSubQuestion,
    getAncestorChain,
    transitionToAnchored,
    showHistoryModal,
    startNewQuestion,
    cancelNewQuestion,
    deleteNode,
    deleteSubQuestion,
    reset,
  }
})
