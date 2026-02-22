import { useSettingsStore } from '@/stores/settings'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function getConfig() {
  const s = useSettingsStore()
  return {
    baseUrl: s.baseUrl,
    apiKey: s.apiKey,
    model: s.model,
    isOllama: s.provider === 'ollama',
  }
}

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const { baseUrl, apiKey, model, isOllama } = getConfig()

  if (isOllama) {
    // Ollama native /api/chat endpoint
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`)
    const data = await res.json()
    return data.message?.content ?? ''
  } else {
    // OpenAI-compatible /chat/completions endpoint
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, stream: false }),
    })
    if (!res.ok) throw new Error(`AI provider error: ${res.status} ${res.statusText}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }
}

/**
 * Ask a main question (no prior context).
 */
export function askMainQuestion(question: string): Promise<string> {
  return chatCompletion([
    {
      role: 'system',
      content:
        'You are a helpful learning assistant. Give clear, detailed explanations. When your answer mentions related concepts, highlight them so the student can explore further.',
    },
    { role: 'user', content: question },
  ])
}

export interface AncestorContext {
  question: string
  answer: string
}

/**
 * Ask a sub-question anchored to the current node and all its parent anchors.
 * Context includes the full ancestor chain (root → current node) plus this sub-question.
 */
export function askSubQuestion(ancestors: AncestorContext[], question: string): Promise<string> {
  const contextBlock = ancestors
    .map((a, i) => {
      const label = i === 0 ? 'Root explanation' : `Parent context ${i}`
      return `[${label}]\nQ: ${a.question}\nA: ${a.answer}`
    })
    .join('\n\n')

  return chatCompletion([
    {
      role: 'system',
      content:
        'You are a helpful learning assistant. The user is studying a topic and has a follow-up question. Answer using only the provided context chain. Be concise and focused.',
    },
    {
      role: 'user',
      content: `Here is my study context:\n\n---\n${contextBlock}\n---\n\nMy follow-up question: ${question}`,
    },
  ])
}
