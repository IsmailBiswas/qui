const OLLAMA_BASE = 'http://localhost:11434'
const MODEL = 'qwen2.5:3b'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
    }),
  })

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  return data.message?.content ?? ''
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

/**
 * Ask a sub-question anchored to a specific answer.
 * Context is strictly: the anchor answer + this one sub-question. Nothing else.
 */
export function askSubQuestion(anchorAnswer: string, question: string): Promise<string> {
  return chatCompletion([
    {
      role: 'system',
      content:
        'You are a helpful learning assistant. The user is reading an explanation and has a follow-up question about it. Answer using only the context of the original explanation provided. Be concise and focused.',
    },
    {
      role: 'user',
      content: `Here is the original explanation I was reading:\n\n---\n${anchorAnswer}\n---\n\nMy question about it: ${question}`,
    },
  ])
}
