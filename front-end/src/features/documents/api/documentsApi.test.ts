import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { delay, http, HttpResponse } from 'msw'
import { documentsApi } from './documentsApi.ts'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())
it('sends filters, omits absent params and handles 204 without JSON', async () => {
  let query = ''
  server.use(
    http.get('/api/documents', ({ request }) => {
      query = new URL(request.url).search
      return HttpResponse.json({ content: [], totalPages: 0 })
    }),
    http.delete('/api/documents/4', ({ request }) => {
      expect(new URL(request.url).searchParams.get('version')).toBe('3')
      return new HttpResponse(null, { status: 204 })
    }),
  )
  await documentsApi.list({
    direction: 'INTERNAL',
    status: 'DRAFT',
    departmentId: 2,
    page: 1,
    size: 20,
  })
  const params = new URLSearchParams(query)
  expect(Object.fromEntries(params)).toEqual({
    direction: 'INTERNAL',
    status: 'DRAFT',
    departmentId: '2',
    page: '1',
    size: '20',
  })
  await expect(documentsApi.remove(4, 3)).resolves.toBeUndefined()
})
it('cancels a pending request through the HTTP client', async () => {
  server.use(
    http.get('/api/documents/1', async () => {
      await delay(100)
      return HttpResponse.json({ id: 1 })
    }),
  )
  const controller = new AbortController()
  const pending = documentsApi.get(1, controller.signal)
  controller.abort()
  await expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' })
})
it('rejects the OCR service array that shares /documents', async () => {
  server.use(http.get('/api/documents', () => HttpResponse.json([{ id: 1 }])))
  await expect(
    documentsApi.list({ direction: 'INCOMING', page: 0, size: 10 }),
  ).rejects.toThrow('Unexpected /documents response')
})
