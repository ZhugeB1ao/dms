import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from '@/mocks/handlers.ts'
import { api, authHttp, session } from '@/shared/api/http.ts'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  resetMock()
  session.clear()
})

async function login(username: string) {
  const { data } = await authHttp.post('/auth/login', {
    username,
    password: 'Demo12345!',
  })
  session.set(data.accessToken, data.refreshToken)
}

const inbox = '/documents/pending-approvals'
const transition = '/documents/31/workflow/transition'

it('keeps approval assignment, filters, versions and publication consistent', async () => {
  await login('employee')
  const reviewers = await api.get('/documents/31/workflow/reviewers')
  expect(reviewers.data).toEqual([{ id: 2, name: 'manager' }])
  await expect(api.get(inbox)).rejects.toMatchObject({
    response: { status: 403 },
  })
  const submitted = await api.post(transition, {
    action: 'submit',
    reviewerId: 2,
    version: 1,
  })
  expect(submitted.data).toMatchObject({
    status: 'PENDING_APPROVAL',
    version: 2,
  })
  await expect(documentsApi.remove(31, 2)).rejects.toMatchObject({
    response: { status: 409 },
  })

  await login('manager')
  const { data: queue } = await api.get(inbox, {
    params: { direction: 'INCOMING' },
  })
  expect(queue).toMatchObject({
    content: [],
    totalElements: 0,
    pendingCount: 1,
  })
  expect((await api.get(inbox)).data.content).toMatchObject([{ id: 31 }])
  const { data: approved } = await api.post(transition, {
    action: 'approve',
    version: 2,
  })
  expect(approved.status).toBe('READY_TO_PUBLISH')
  expect((await api.get(inbox)).data.pendingCount).toBe(0)

  const writes = await Promise.allSettled([
    api.post(transition, { action: 'publish', version: 3 }),
    api.post(transition, { action: 'publish', version: 3 }),
  ])
  expect(writes.filter((write) => write.status === 'fulfilled')).toHaveLength(1)
  expect(writes.find((write) => write.status === 'rejected')).toMatchObject({
    reason: { response: { status: 409 } },
  })
  const published = await documentsApi.get(31)
  expect(published.documentNumber).toMatch(/\S/)
  await api.post(transition, {
    action: 'recall',
    reason: ' Correct number ',
    version: 4,
  })
  expect(await documentsApi.get(31)).toMatchObject({
    status: 'RECALLED',
    documentNumber: published.documentNumber,
  })
  const history = await documentsApi.history(31)
  expect(history.map((entry) => entry.action)).toEqual([
    undefined,
    'submit',
    'approve',
    'publish',
    'recall',
  ])
  expect(history.at(-1)?.note).toBe('Correct number')
})

it('enforces reviewer assignment and requires a rejection reason', async () => {
  await login('employee')
  await api.post(transition, { action: 'submit', reviewerId: 2, version: 1 })
  await login('admin')
  await expect(
    api.post(transition, { action: 'approve', version: 2 }),
  ).rejects.toMatchObject({
    response: { status: 403 },
  })
  await login('manager')
  await expect(
    api.post(transition, { action: 'reject', reason: '  ', version: 2 }),
  ).rejects.toMatchObject({
    response: {
      status: 422,
      data: { fieldErrors: { reason: expect.any(String) } },
    },
  })
  expect((await documentsApi.get(31)).version).toBe(2)
  await api.post(transition, {
    action: 'reject',
    reason: ' Wrong recipient ',
    version: 2,
  })
  expect((await documentsApi.get(31)).status).toBe('REJECTED')
  expect((await documentsApi.history(31)).at(-1)?.note).toBe('Wrong recipient')
})

it('serves mock attachment content within document read scope', async () => {
  await login('employee')
  await api.post(transition, { action: 'submit', reviewerId: 2, version: 1 })
  await login('manager')
  expect(
    (await documentsApi.attachments(31)).find((item) => item.canDownload)?.id,
  ).toBe(2)
  expect((await api.get('/documents/31/attachments/2/content')).data).toContain(
    'Sample attachment',
  )
  await login('other')
  await expect(
    api.get('/documents/31/attachments/2/content'),
  ).rejects.toMatchObject({
    response: { status: 403 },
  })
})

it('lets another manager in the department read but keeps decisions and inbox private to the reviewer', async () => {
  await login('employee')
  await api.post(transition, { action: 'submit', reviewerId: 2, version: 1 })
  await login('admin')
  await api.put('/accounts/11', {
    email: 'staff07@demo.test',
    departmentId: 1,
    role: 'MANAGER',
    position: null,
  })
  await login('staff07')
  expect(await documentsApi.get(31)).toMatchObject({
    status: 'PENDING_APPROVAL',
  })
  expect((await api.get(inbox)).data).toMatchObject({
    content: [],
    pendingCount: 0,
  })
  await expect(
    api.post(transition, { action: 'approve', version: 2 }),
  ).rejects.toMatchObject({
    response: { status: 403 },
  })
  await expect(
    api.post(transition, {
      action: 'reject',
      reason: 'Wrong recipient',
      version: 2,
    }),
  ).rejects.toMatchObject({
    response: { status: 403 },
  })
  expect((await documentsApi.get(31)).version).toBe(2)
})
