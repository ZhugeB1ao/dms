import { afterEach, expect, it } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { setupServer } from 'msw/node'
import { api, authHttp, session } from './http.ts'

const server = setupServer()
afterEach(() => {
  server.close()
  session.clear()
})
it('shares one refresh across concurrent 401 requests and retries once', async () => {
  let refreshes = 0
  server.use(
    http.post('http://localhost/api/v1/auth/refresh', () => {
      refreshes++
      return HttpResponse.json({ accessToken: 'new' })
    }),
    http.get('http://localhost/api/v1/check', ({ request }) =>
      request.headers.get('Authorization') === 'Bearer new'
        ? HttpResponse.json({ ok: true })
        : new HttpResponse(null, { status: 401 }),
    ),
  )
  server.listen({ onUnhandledFrame: 'error' })
  session.set('old')
  await Promise.all(Array.from({ length: 5 }, () => api.get('/check')))
  expect(refreshes).toBe(1)
})
it('does not loop when the replay is unauthorized', async () => {
  let refreshes = 0,
    requests = 0
  server.use(
    http.post('http://localhost/api/v1/auth/refresh', () => {
      refreshes++
      return HttpResponse.json({ accessToken: 'new' })
    }),
    http.get('http://localhost/api/v1/check', () => {
      requests++
      return new HttpResponse(null, { status: 401 })
    }),
  )
  server.listen({ onUnhandledFrame: 'error' })
  await expect(api.get('/check')).rejects.toBeDefined()
  expect(refreshes).toBe(1)
  expect(requests).toBe(2)
  expect(session.token).toBe(null)
})
it('never refreshes a failed login', async () => {
  server.use(
    http.post(
      'http://localhost/api/v1/auth/login',
      () => new HttpResponse(null, { status: 401 }),
    ),
  )
  server.listen({ onUnhandledFrame: 'error' })
  await expect(authHttp.post('/auth/login', {})).rejects.toBeDefined()
})

it.each([401, 500])('ends session when refresh returns %s', async (status) => {
  let calls = 0
  server.use(
    http.get('http://localhost/api/v1/check', () => {
      calls++
      return new HttpResponse(null, { status: 401 })
    }),
    http.post(
      'http://localhost/api/v1/auth/refresh',
      () => new HttpResponse(null, { status }),
    ),
  )
  server.listen({ onUnhandledFrame: 'error' })
  session.set('old')
  await expect(api.get('/check')).rejects.toBeDefined()
  expect(calls).toBe(1)
  expect(session.token).toBeNull()
})
it('discards refresh response after logout', async () => {
  let started!: () => void
  const pending = new Promise<void>((resolve) => {
    started = resolve
  })
  server.use(
    http.get(
      'http://localhost/api/v1/check',
      () => new HttpResponse(null, { status: 401 }),
    ),
    http.post('http://localhost/api/v1/auth/refresh', async () => {
      started()
      await delay(50)
      return HttpResponse.json({ accessToken: 'stale' })
    }),
  )
  server.listen({ onUnhandledFrame: 'error' })
  const request = api.get('/check').catch((error) => error)
  await pending
  session.clear()
  await request
  expect(session.token).toBeNull()
})
