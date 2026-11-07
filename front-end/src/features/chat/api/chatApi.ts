import { session, refreshSession } from '../../../shared/api/http.ts'
import type { SourceCitation } from '../types.ts'
import rawData from '../data/conversations.json'

const CHAT_BASE_URL =
  import.meta.env.VITE_CHAT_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:9090'

interface RawApiSource {
  source: string
  text: string
  score: number
}

export interface StreamCallbacks {
  onSources?: (sources: SourceCitation[], inScope: boolean) => void
  onDelta?: (text: string) => void
}

export const chatApi = {
  async askQuestionStream(
    question: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    top_k?: number,
  ): Promise<void> {
    const { onSources, onDelta } = callbacks
    try {
      const endpoint = CHAT_BASE_URL.includes('9090')
        ? `${CHAT_BASE_URL}/api/ai/ask/stream`
        : `${CHAT_BASE_URL}/ask/stream`

      const doFetch = (bearer: string | null) =>
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
          body: JSON.stringify({
            question,
            ...(top_k !== undefined ? { top_k } : {}),
          }),
          signal,
        })

      let res = await doFetch(session.token)
      if (res.status === 401) {
        const freshToken = await refreshSession().catch(() => null)
        if (freshToken) {
          res = await doFetch(freshToken)
        }
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || `Lỗi máy chủ (${res.status})`)
      }
      if (!res.body) {
        throw new Error('Trình duyệt không hỗ trợ ReadableStream.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine.startsWith('data: ')) {
            const raw = trimmedLine.slice(6).trim()
            if (raw === '[DONE]') return
            try {
              const payload = JSON.parse(raw)
              if (payload.event === 'sources' && onSources) {
                const mappedSources: SourceCitation[] = (
                  payload.sources || []
                ).map((s: RawApiSource, index: number) => ({
                  id: `src-${Date.now()}-${index}`,
                  type: 'document',
                  title: s.source,
                  description: `Độ tương đồng: ${(s.score * 100).toFixed(1)}%`,
                  text: s.text,
                  score: s.score,
                  fileType: s.source.split('.').pop()?.toUpperCase() || 'DOC',
                }))
                onSources(mappedSources, payload.in_scope ?? true)
              } else if (payload.event === 'delta' && onDelta) {
                onDelta(payload.text)
              }
            } catch {
              // Ignore malformed SSE chunk
            }
          }
        }
      }
    } catch {
      if (signal?.aborted) return
      if (onSources) {
        onSources(rawData.sources as SourceCitation[], true)
      }
      if (onDelta) {
        const mockText = `Mình đã nhận được câu hỏi: "${question}".\n\n(Lưu ý: Hiện đang ở chế độ mô phỏng Offline / MSW. Hãy kết nối RAG Backend tại ${CHAT_BASE_URL} để nhận câu trả lời dạng SSE stream từ mô hình RAG).`
        onDelta(mockText)
      }
    }
  },
}
