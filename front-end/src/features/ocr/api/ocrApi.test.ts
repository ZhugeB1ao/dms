import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { session } from '../../../shared/api/http.ts'
import { chatApi } from '../../chat/api/chatApi.ts'
import { ocrApi } from './ocrApi.ts'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  session.clear()
  sessionStorage.clear()
})
afterAll(() => server.close())

describe('ocrApi & chatApi real API integration via env.apiBaseUrl (/api)', () => {
  it('calls /api/documents endpoints directly without double /api prefix', async () => {
    session.set('valid-jwt', 'valid-refresh')
    const hitPaths: string[] = []

    server.use(
      http.get('/api/documents', ({ request }) => {
        hitPaths.push(new URL(request.url).pathname)
        expect(request.headers.get('authorization')).toBe('Bearer valid-jwt')
        return HttpResponse.json([
          {
            id: 42,
            title: 'Quy chế đào tạo',
            originalFileName: 'quy-che.pdf',
            fileSize: 2048,
            ocrStatus: 'COMPLETED',
            uploadDate: '2026-10-15T08:00:00Z',
          },
        ])
      }),
      http.post('/api/documents/upload', ({ request }) => {
        hitPaths.push(new URL(request.url).pathname)
        return HttpResponse.json({
          status: 'success',
          id: '43',
          ocrStatus: 'PENDING',
        })
      }),
      http.get('/api/documents/42/text', ({ request }) => {
        hitPaths.push(new URL(request.url).pathname)
        return HttpResponse.json({
          id: 42,
          ocrStatus: 'COMPLETED',
          text: 'Nội dung trích xuất thật từ Tesseract',
        })
      }),
      http.post('/api/documents/42/ocr', ({ request }) => {
        hitPaths.push(new URL(request.url).pathname)
        return HttpResponse.json({ status: 'success' }, { status: 202 })
      }),
      http.post('/api/documents/42/embed', ({ request }) => {
        hitPaths.push(new URL(request.url).pathname)
        return HttpResponse.json({ status: 'success' }, { status: 202 })
      }),
    )

    const docs = await ocrApi.fetchDocuments()
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      id: 42,
      title: 'Quy chế đào tạo',
      fileName: 'quy-che.pdf',
      fileSize: '2.0 KB',
      ocrStatus: 'COMPLETED',
    })

    const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' })
    const uploaded = await ocrApi.uploadDocument(file, 'Tài liệu test')
    expect(uploaded.id).toBe(43)
    expect(uploaded.ocrStatus).toBe('PENDING')

    const text = await ocrApi.fetchDocumentText(42)
    expect(text).toBe('Nội dung trích xuất thật từ Tesseract')

    await ocrApi.retryOcr(42)
    expect(await ocrApi.embedDocument(42)).toBe(true)

    expect(hitPaths).toEqual([
      '/api/documents',
      '/api/documents/upload',
      '/api/documents/42/text',
      '/api/documents/42/ocr',
      '/api/documents/42/embed',
    ])
  })

  it('refreshes token on 401 and throws real errors instead of returning mock INITIAL_MOCK_DOCS', async () => {
    session.set('expired-jwt', 'refresh-1')

    server.use(
      http.get('/api/documents', ({ request }) => {
        if (request.headers.get('authorization') === 'Bearer fresh-jwt') {
          return HttpResponse.json([])
        }
        return HttpResponse.json({ message: 'Expired' }, { status: 401 })
      }),
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({
          accessToken: 'fresh-jwt',
          refreshToken: 'refresh-2',
          tokenType: 'Bearer',
        }),
      ),
    )

    expect(await ocrApi.fetchDocuments()).toEqual([])
    expect(session.token).toBe('fresh-jwt')

    server.use(
      http.get('/api/documents', () =>
        HttpResponse.json({ error: 'Database unavailable' }, { status: 500 }),
      ),
    )

    await expect(ocrApi.fetchDocuments()).rejects.toThrow(
      'Database unavailable',
    )
    expect(sessionStorage.getItem('mock_documents')).toBeNull()
  })

  it('streams SSE from /api/ai/ask/stream and throws real errors instead of offline mock text', async () => {
    session.set('valid-jwt', 'valid-refresh')
    const deltas: string[] = []
    let receivedSourcesCount = 0

    server.use(
      http.post('/api/ai/ask/stream', async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer valid-jwt')
        const body = (await request.json()) as { question: string }
        expect(body.question).toBe('Điều kiện tốt nghiệp?')
        const sse = [
          'data: {"event":"sources","in_scope":true,"sources":[{"source":"quy_che.pdf","text":"Điều 3","score":0.92}]}',
          'data: {"event":"delta","text":"Tích lũy đủ "}',
          'data: {"event":"delta","text":"tín chỉ."}',
          'data: [DONE]',
          '',
        ].join('\n\n')
        return new HttpResponse(sse, {
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }),
    )

    await chatApi.askQuestionStream('Điều kiện tốt nghiệp?', {
      onSources: (sources) => {
        receivedSourcesCount = sources.length
      },
      onDelta: (chunk) => deltas.push(chunk),
    })

    expect(receivedSourcesCount).toBe(1)
    expect(deltas.join('')).toBe('Tích lũy đủ tín chỉ.')

    server.use(
      http.post('/api/ai/ask/stream', () =>
        HttpResponse.json(
          { detail: 'Qdrant connection refused' },
          { status: 503 },
        ),
      ),
    )

    const errorDeltas: string[] = []
    await expect(
      chatApi.askQuestionStream('Câu hỏi lỗi', {
        onDelta: (chunk) => errorDeltas.push(chunk),
      }),
    ).rejects.toThrow('Qdrant connection refused')
    expect(errorDeltas).toEqual([])
  })
})
