export interface AnchorNode {
  id: string
  question: string
  answer: string
  loading: boolean
  parentId: string | null
  childIds: string[]
  subQuestions: SubQuestion[]
}

export interface SubQuestion {
  id: string
  anchorId: string
  question: string
  answer: string
  loading: boolean
}
