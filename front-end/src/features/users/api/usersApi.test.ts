import { beforeAll, afterAll, afterEach, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { usersApi } from './usersApi.ts'
import { session } from '../../../shared/api/http.ts'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  session.clear()
})
it('sends the account-service query, status and password-reset payloads', async () => {
  let query: Record<string, string> = {}
  let status: unknown
  let reset: unknown
  server.use(
    http.get('http://localhost/api/accounts', ({ request }) => {
      query = Object.fromEntries(new URL(request.url).searchParams)
      return HttpResponse.json({
        content: [],
        page: 2,
        size: 20,
        totalElements: 0,
        totalPages: 0,
      })
    }),
    http.patch(
      'http://localhost/api/accounts/3/status',
      async ({ request }) => {
        status = await request.json()
        return HttpResponse.json({ id: 3 })
      },
    ),
    http.post(
      'http://localhost/api/accounts/3/reset-password',
      async ({ request }) => {
        reset = await request.json()
        return new HttpResponse(null, { status: 204 })
      },
    ),
  )
  const result = await usersApi.list({
    page: 2,
    size: 20,
    departmentId: 1,
    role: 'EMPLOYEE',
    active: false,
  })
  expect(query).toEqual({
    page: '2',
    size: '20',
    departmentId: '1',
    role: 'EMPLOYEE',
    active: 'false',
  })
  expect(result.content).toEqual([])
  await usersApi.setActive(3, false)
  expect(status).toEqual({ active: false })
  expect(
    await usersApi.resetPassword(3, { tempPassword: 'New12345!' }),
  ).toBeUndefined()
  expect(reset).toEqual({ tempPassword: 'New12345!' })
})
it('cancels a request that has already been aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(
    usersApi.list({ page: 0, size: 10 }, controller.signal),
  ).rejects.toMatchObject({ code: 'ERR_CANCELED' })
})
