import { env } from '../../../config/env.ts'
import { refreshSession, session } from '../../../shared/api/http.ts'
import type { SourceCitation } from '../types.ts'

interface RawApiSource {
  source: string
  text: string
  score: number
}

interface StreamPayload {
  event?: string
  sources?: RawApiSource[]
  in_scope?: boolean
  text?: string
  detail?: string
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
    const endpoint = `${env.apiBaseUrl}/ai/ask/stream`

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

    try {
      let res = await doFetch(session.token)
      if (res.status === 401) {
        const freshToken = await refreshSession().catch(() => null)
        if (freshToken) {
          res = await doFetch(freshToken)
        }
      }

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          detail?: string
          message?: string
        }
        throw new Error(
          errorData.detail ||
            errorData.message ||
            `Server error (${res.status})`,
        )
      }
      if (!res.body) {
        throw new Error('This browser does not support ReadableStream.')
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
          if (!trimmedLine.startsWith('data: ')) continue
          const raw = trimmedLine.slice(6).trim()
          if (raw === '[DONE]') return

          let payload: StreamPayload | null = null
          try {
            payload = JSON.parse(raw) as StreamPayload
          } catch {
            // Ignore malformed SSE chunk
          }
          if (!payload) continue

          if (payload.event === 'error') {
            throw new Error(payload.detail || 'The AI service returned an error.')
          }
          if (payload.event === 'sources' && onSources) {
            const mappedSources: SourceCitation[] = (payload.sources || []).map(
              (s: RawApiSource, index: number) => ({
                id: `src-${Date.now()}-${index}`,
                type: 'document',
                title: s.source,
                description: `Similarity: ${(s.score * 100).toFixed(1)}%`,
                text: s.text,
                score: s.score,
                fileType: s.source.split('.').pop()?.toUpperCase() || 'DOC',
              }),
            )
            onSources(mappedSources, payload.in_scope ?? true)
          } else if (payload.event === 'delta' && onDelta && payload.text) {
            onDelta(payload.text)
          }
        }
      }
    } catch (err) {
      if (signal?.aborted) return
      throw err
    }
  },
}
