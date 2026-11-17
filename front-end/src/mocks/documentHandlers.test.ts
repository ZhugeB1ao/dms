import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from '@/mocks/handlers.ts'
import { api, authHttp, session } from '@/shared/api/http.ts'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import { categoryApi } from '@/features/categories/api/categoryApi.ts'
import { documentStore } from '@/mocks/documents.ts'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  resetMock()
  session.clear()
  server.resetHandlers()
})
async function login(username = 'admin') {
  const { data } = await authHttp.post('/auth/login', {
    username,
    password: 'Demo12345!',
  })
  session.set(data.accessToken, data.refreshToken)
}
const input = {
  direction: 'INCOMING' as const,
  summary: 'New draft',
  documentTypeId: 1,
  urgencyId: 4,
  confidentialityId: 7,
  issuingOrganizationId: 1,
  departmentId: 2,
}
it('creates, edits, rejects stale writes and deletes a draft', async () => {
  await login()
  const doc = await documentsApi.create(input)
  expect(doc.status).toBe('DRAFT')
  expect(await documentsApi.history(doc.id)).toHaveLength(1)
  const updated = await documentsApi.update(doc.id, {
    ...input,
    summary: 'Updated',
    version: doc.version,
  })
  expect(updated.version).toBe(2)
  await expect(documentsApi.remove(doc.id, 1)).rejects.toMatchObject({
    response: { status: 409 },
  })
  expect((await documentsApi.get(doc.id)).summary).toBe('Updated')
  await documentsApi.remove(doc.id, 2)
  await expect(documentsApi.get(doc.id)).rejects.toMatchObject({
    response: { status: 404 },
  })
})
it('filters before counting and paging and validates query', async () => {
  await login()
  const result = await documentsApi.list({
    direction: 'INCOMING',
    page: 0,
    size: 10,
    departmentId: 2,
    status: 'DRAFT',
  })
  expect(result.totalElements).toBeGreaterThan(0)
  expect(
    result.content.every(
      (d) =>
        d.direction === 'INCOMING' &&
        d.departmentId === 2 &&
        d.status === 'DRAFT',
    ),
  ).toBe(true)
  await expect(
    api.get('/documents?direction=INCOMING&page=-1'),
  ).rejects.toMatchObject({ response: { status: 400 } })
})
it('enforces owner, department, status and read scopes independently of UI', async () => {
  await login()
  const doc = await documentsApi.create(input)
  await login('employee')
  await expect(documentsApi.get(doc.id)).rejects.toMatchObject({
    response: { status: 403 },
  })
  const own = await documentsApi.create({ ...input, departmentId: 1 })
  await expect(
    documentsApi.update(own.id, { ...input, departmentId: 3, version: 1 }),
  ).rejects.toMatchObject({ response: { status: 403 } })
  await login('manager')
  await expect(documentsApi.get(doc.id)).rejects.toMatchObject({
    response: { status: 403 },
  })
  await login()
  const published = (
    await documentsApi.list({
      direction: 'INCOMING',
      status: 'PUBLISHED',
      page: 0,
      size: 10,
    })
  ).content[0]
  await expect(documentsApi.remove(published.id, 1)).rejects.toMatchObject({
    response: { status: 409 },
  })
})
it('rejects invalid fields and ignores forged state/owner', async () => {
  await login()
  await expect(
    documentsApi.create({ ...input, summary: ' ', urgencyId: 1 }),
  ).rejects.toMatchObject({ response: { status: 422 } })
  const { data } = await api.post('/documents', {
    ...input,
    createdBy: 99,
    status: 'PUBLISHED',
  })
  expect(data.createdBy).toBe(1)
  expect(data.status).toBe('DRAFT')
})
it('does not permit unauthenticated reads or leak history/files', async () => {
  await expect(
    api.get('/documents/1', { skipRefresh: true }),
  ).rejects.toMatchObject({ response: { status: 401 } })
  await login('employee')
  await expect(documentsApi.history(2)).rejects.toMatchObject({
    response: { status: 403 },
  })
  await expect(documentsApi.attachments(2)).rejects.toMatchObject({
    response: { status: 403 },
  })
})
it('preserves inactive selections on update, reports current lookup state, and rejects new selections', async () => {
  await login()
  const doc = await documentsApi.create(input)
  await categoryApi.deactivate(1)
  expect((await documentsApi.get(doc.id)).lookups.documentType.isActive).toBe(
    false,
  )
  await expect(documentsApi.create(input)).rejects.toMatchObject({
    response: {
      status: 422,
      data: { fieldErrors: { documentTypeId: expect.any(String) } },
    },
  })
  expect(
    (
      await documentsApi.update(doc.id, {
        ...input,
        summary: 'Kept old type',
        version: 1,
      })
    ).summary,
  ).toBe('Kept old type')
})
it('allows assignee reads but denies writes and filters Manager totals by department', async () => {
  documentStore.documents[1].assigneeIds = [3]
  documentStore.documents[1].status = 'DRAFT'
  await login('employee')
  expect((await documentsApi.get(2)).createdBy).toBe(1)
  await expect(
    documentsApi.update(2, { ...input, version: 1 }),
  ).rejects.toMatchObject({ response: { status: 403 } })
  await expect(documentsApi.remove(2, 1)).rejects.toMatchObject({
    response: { status: 403 },
  })
  await login('manager')
  const page = await documentsApi.list({
    direction: 'INCOMING',
    page: 0,
    size: 20,
  })
  expect(page.totalElements).toBe(15)
  expect(page.content.every((doc) => doc.departmentId === 1)).toBe(true)
})
