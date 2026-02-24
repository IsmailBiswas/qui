import { useSettingsStore } from '@/stores/settings'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function getConfig() {
  const s = useSettingsStore()
  return {
    baseUrl: s.baseUrl,
    apiKey:  s.apiKey,
    model:   s.model,
    isOllama: s.provider === 'ollama',
  }
}

// ── Core streaming generator ───────────────────────────────────────────────
// Yields string tokens as they arrive from the provider.

export async function* chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const { baseUrl, apiKey, model, isOllama } = getConfig()
  const decoder = new TextDecoder()

  if (isOllama) {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, messages, stream: true }),
    })
    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`)

    const reader = res.body!.getReader()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line)
          if (json.message?.content) yield json.message.content as string
          if (json.done) return
        } catch { /* skip malformed */ }
      }
    }
  } else {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method:  'POST',
      headers,
      body:    JSON.stringify({ model, messages, stream: true }),
    })
    if (!res.ok) throw new Error(`AI provider error: ${res.status} ${res.statusText}`)

    const reader = res.body!.getReader()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') return
        try {
          const json  = JSON.parse(payload)
          const token = json.choices?.[0]?.delta?.content as string | undefined
          if (token) yield token
        } catch { /* skip malformed */ }
      }
    }
  }
}

// ── Public streaming helpers ───────────────────────────────────────────────

export function streamMainQuestion(question: string): AsyncGenerator<string> {
  return chatStream([
    {
      role:    'system',
      content: 'You are a helpful learning assistant. Give clear, detailed explanations. When your answer mentions related concepts, highlight them so the student can explore further.',
    },
    { role: 'user', content: question },
  ])
}

export interface AncestorContext {
  question: string
  answer:   string
}

export function streamSubQuestion(
  ancestors: AncestorContext[],
  question:  string,
): AsyncGenerator<string> {
  const contextBlock = ancestors
    .map((a, i) => {
      const label = i === 0 ? 'Root explanation' : `Parent context ${i}`
      return `[${label}]\nQ: ${a.question}\nA: ${a.answer}`
    })
    .join('\n\n')

  return chatStream([
    {
      role:    'system',
      content: 'You are a helpful learning assistant. The user is studying a topic and has a follow-up question. Asnwer them pragmatically.',
    },
    {
      role:    'user',
      content: `Here is my study context:\n\n---\n${contextBlock}\n---\n\nMy follow-up question: ${question}`,
    },
  ])
}

// ── Convenience batch wrappers (collects full stream into one string) ──────

export async function collectStream(gen: AsyncGenerator<string>): Promise<string> {
  let out = ''
  for await (const token of gen) out += token
  return out
}

export const askMainQuestion = (q: string)                                    => collectStream(streamMainQuestion(q))
export const askSubQuestion  = (a: AncestorContext[], q: string)              => collectStream(streamSubQuestion(a, q))
