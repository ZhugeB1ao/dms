import { beforeAll, afterAll, afterEach, expect, it } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { setupServer } from 'msw/node'
import { env } from '../../config/env.ts'
import { api, authHttp, backendHttp, session } from './http.ts'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  session.clear()
})

it('uses /api as unified baseURL and disables runtime mocks by default', () => {
  expect(env.apiBaseUrl).toBe('/api')
  expect(env.mockEnabled).toBe(false)
  expect(api.defaults.baseURL).toBe('/api')
  expect(authHttp.defaults.baseURL).toBe('/api')
  expect(backendHttp.defaults.baseURL).toBe('/api')
})

it('shares one refresh with refreshToken body across concurrent 401 requests and rotates tokens', async () => {
  let refreshes = 0
  let receivedRefreshBody: unknown = null
  server.use(
    http.post('/api/auth/refresh', async ({ request }) => {
      refreshes++
      receivedRefreshBody = await request.json()
      return HttpResponse.json({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        tokenType: 'Bearer',
      })
    }),
    http.get('/api/check', ({ request }) =>
      request.headers.get('Authorization') === 'Bearer new-access'
        ? HttpResponse.json({ ok: true })
        : new HttpResponse(null, { status: 401 }),
    ),
  )
  session.set('old-access', 'old-refresh')
  await Promise.all(Array.from({ length: 5 }, () => api.get('/check')))
  expect(refreshes).toBe(1)
  expect(receivedRefreshBody).toEqual({ refreshToken: 'old-refresh' })
  expect(session.token).toBe('new-access')
  expect(session.refreshToken).toBe('new-refresh')
})

it('does not loop when the replay is unauthorized', async () => {
  let refreshes = 0,
    requests = 0
  server.use(
    http.post('/api/auth/refresh', () => {
      refreshes++
      return HttpResponse.json({
        accessToken: 'new',
        refreshToken: 'rotated',
      })
    }),
    http.get('/api/check', () => {
      requests++
      return new HttpResponse(null, { status: 401 })
    }),
  )
  session.set('old', 'seed-refresh')
  await expect(api.get('/check')).rejects.toBeDefined()
  expect(refreshes).toBe(1)
  expect(requests).toBe(2)
  expect(session.token).toBe(null)
  expect(session.refreshToken).toBe(null)
})

it('never refreshes a failed login', async () => {
  server.use(
    http.post('/api/auth/login', () => new HttpResponse(null, { status: 401 })),
  )
  await expect(authHttp.post('/auth/login', {})).rejects.toBeDefined()
})

it.each([401, 500])('ends session when refresh returns %s', async (status) => {
  let calls = 0
  server.use(
    http.get('/api/check', () => {
      calls++
      return new HttpResponse(null, { status: 401 })
    }),
    http.post('/api/auth/refresh', () => new HttpResponse(null, { status })),
  )
  session.set('old', 'seed-refresh')
  await expect(api.get('/check')).rejects.toBeDefined()
  expect(calls).toBe(1)
  expect(session.token).toBeNull()
  expect(session.refreshToken).toBeNull()
})

it('discards refresh response after logout', async () => {
  let started!: () => void
  const pending = new Promise<void>((resolve) => {
    started = resolve
  })
  server.use(
    http.get('/api/check', () => new HttpResponse(null, { status: 401 })),
    http.post('/api/auth/refresh', async () => {
      started()
      await delay(50)
      return HttpResponse.json({
        accessToken: 'stale',
        refreshToken: 'stale-refresh',
      })
    }),
  )
  session.set('old', 'seed-refresh')
  const request = api.get('/check').catch((error) => error)
  await pending
  session.clear()
  await request
  expect(session.token).toBeNull()
  expect(session.refreshToken).toBeNull()
})

it('auto-refreshes expired JWT on backendHttp for master data endpoints', async () => {
  const capturedHeaders: Array<string | null> = []
  server.use(
    http.post('/api/auth/refresh', () =>
      HttpResponse.json({
        accessToken: 'eyJhbGciOiJIUzI1NiJ9.fresh.jwt',
        refreshToken: 'fresh-rt',
      }),
    ),
    http.get('/api/categories/active', ({ request }) => {
      const auth = request.headers.get('Authorization')
      capturedHeaders.push(auth)
      return auth === 'Bearer eyJhbGciOiJIUzI1NiJ9.fresh.jwt'
        ? HttpResponse.json([])
        : new HttpResponse(null, { status: 401 })
    }),
  )

  session.set('eyJhbGciOiJIUzI1NiJ9.expired.jwt', 'valid-rt')
  const res = await backendHttp.get('/categories/active')
  expect(res.status).toBe(200)
  expect(capturedHeaders).toEqual([
    'Bearer eyJhbGciOiJIUzI1NiJ9.expired.jwt',
    'Bearer eyJhbGciOiJIUzI1NiJ9.fresh.jwt',
  ])
})
