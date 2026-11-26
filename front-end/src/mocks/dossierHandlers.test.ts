import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from '@/mocks/handlers.ts'
import { documentStore } from '@/mocks/documents.ts'
import { api, authHttp, session } from '@/shared/api/http.ts'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  resetMock()
  session.clear()
  server.resetHandlers()
})

async function login(username = 'employee') {
  const { data } = await authHttp.post('/auth/login', {
    username,
    password: 'Demo12345!',
  })
  session.set(data.accessToken, data.refreshToken)
}

it('requires authentication and denies ADMIN access (Phương án A)', async () => {
  await expect(
    api.get('/dossiers', { skipRefresh: true }),
  ).rejects.toMatchObject({ response: { status: 401 } })

  await login('admin')
  await expect(api.get('/dossiers')).rejects.toMatchObject({
    response: { status: 403 },
  })
  await expect(
    api.post('/dossiers', { code: 'HS-2026-99', name: 'Test', year: 2026 }),
  ).rejects.toMatchObject({ response: { status: 403 } })
  await expect(api.get('/dossiers/1')).rejects.toMatchObject({
    response: { status: 403 },
  })
})

it('lists department-scoped dossiers, filters by year/closed, and validates queries', async () => {
  await login('manager')
  const dept1 = await api.get('/dossiers', { params: { page: 0, size: 10 } })
  expect(dept1.data.totalElements).toBe(3)
  expect(
    dept1.data.content.every(
      (d: { departmentId: number }) => d.departmentId === 1,
    ),
  ).toBe(true)

  const open2026 = await api.get('/dossiers', {
    params: { year: 2026, closed: false, page: 0, size: 10 },
  })
  expect(open2026.data.content.map((d: { code: string }) => d.code)).toEqual([
    'HS-2026-01',
  ])
  expect(open2026.data.content[0].documentCount).toBe(1)

  const closedOnly = await api.get('/dossiers', {
    params: { closed: true, page: 0, size: 10 },
  })
  expect(closedOnly.data.content.map((d: { code: string }) => d.code)).toEqual([
    'HS-2026-02',
  ])
  expect(closedOnly.data.content[0].documentCount).toBe(1)

  await expect(
    api.get('/dossiers', { params: { page: -1 } }),
  ).rejects.toMatchObject({ response: { status: 400 } })
  await expect(
    api.get('/dossiers', { params: { year: 1800 } }),
  ).rejects.toMatchObject({ response: { status: 400 } })

  await login('other')
  const dept2 = await api.get('/dossiers', { params: { page: 0, size: 10 } })
  expect(dept2.data.totalElements).toBe(1)
  expect(dept2.data.content[0]).toMatchObject({
    id: 4,
    code: 'HS-2026-01',
    name: 'Operations 2026',
    departmentId: 2,
  })
})

it('hides cross-department dossiers with 404', async () => {
  await login('employee')
  await expect(api.get('/dossiers/4')).rejects.toMatchObject({
    response: { status: 404 },
  })
  await expect(
    api.put('/dossiers/4', { code: 'X', name: 'X', year: 2026 }),
  ).rejects.toMatchObject({ response: { status: 404 } })
  await expect(api.post('/dossiers/4/close')).rejects.toMatchObject({
    response: { status: 404 },
  })
  await expect(api.get('/dossiers/4/documents')).rejects.toMatchObject({
    response: { status: 404 },
  })
  await expect(
    api.post('/dossiers/4/documents', { documentId: 2 }),
  ).rejects.toMatchObject({ response: { status: 404 } })
})

it('creates, edits, enforces unique (departmentId, year, code) and validates fields', async () => {
  await login('employee')
  await expect(
    api.post('/dossiers', { code: ' ', name: '', year: 1899 }),
  ).rejects.toMatchObject({
    response: {
      status: 422,
      data: {
        fieldErrors: {
          code: expect.any(String),
          name: expect.any(String),
          year: expect.any(String),
        },
      },
    },
  })

  await expect(
    api.post('/dossiers', {
      code: ' hs-2026-01 ',
      name: 'Duplicate',
      year: 2026,
    }),
  ).rejects.toMatchObject({
    response: {
      status: 409,
      data: { fieldErrors: { code: expect.any(String) } },
    },
  })

  const diffYear = await api.post('/dossiers', {
    code: 'HS-2026-01',
    name: 'Same code in 2025',
    year: 2025,
  })
  expect(diffYear.status).toBe(201)
  expect(diffYear.data).toMatchObject({
    code: 'HS-2026-01',
    year: 2025,
    departmentId: 1,
    closed: false,
    documentCount: 0,
  })

  const updated = await api.put(`/dossiers/${diffYear.data.id}`, {
    code: 'HS-2025-99',
    name: 'Renamed 2025',
    year: 2025,
  })
  expect(updated.data).toMatchObject({
    code: 'HS-2025-99',
    name: 'Renamed 2025',
  })

  await expect(
    api.put(`/dossiers/${diffYear.data.id}`, {
      code: 'HS-2025-01',
      name: 'Conflict',
      year: 2025,
    }),
  ).rejects.toMatchObject({
    response: {
      status: 409,
      data: { fieldErrors: { code: expect.any(String) } },
    },
  })
})

it('closes a dossier and blocks updates, repeated close, attach and detach', async () => {
  await login('manager')
  const closed = await api.post('/dossiers/1/close')
  expect(closed.data.closed).toBe(true)

  await expect(api.post('/dossiers/1/close')).rejects.toMatchObject({
    response: { status: 409 },
  })
  await expect(
    api.put('/dossiers/1', { code: 'HS-2026-01', name: 'Changed', year: 2026 }),
  ).rejects.toMatchObject({ response: { status: 409 } })
  await expect(
    api.post('/dossiers/1/documents', { documentId: 1 }),
  ).rejects.toMatchObject({ response: { status: 409 } })
  await expect(api.delete('/dossiers/1/documents/7')).rejects.toMatchObject({
    response: { status: 409 },
  })
})

it('lists attached and available documents, attaches and detaches with visibility/dept/idempotency checks', async () => {
  await login('admin')
  const adminDoc = await api.post('/documents', {
    direction: 'INCOMING',
    summary: 'Admin created doc in Dept 1',
    documentTypeId: 1,
    urgencyId: 4,
    confidentialityId: 7,
    issuingOrganizationId: 1,
    departmentId: 1,
    dossierId: 1,
  })

  await login('manager')
  const managerAttached = await api.get('/dossiers/1/documents')
  expect(managerAttached.data.map((d: { id: number }) => d.id)).toEqual([
    adminDoc.data.id,
    7,
  ])

  await login('employee')
  const attached = await api.get('/dossiers/1/documents')
  expect(attached.data.map((d: { id: number }) => d.id)).toEqual([7])

  const available = await api.get('/dossiers/1/available-documents')
  const availableIds = available.data.map((d: { id: number }) => d.id)
  expect(availableIds).toContain(1)
  expect(availableIds).not.toContain(2)
  expect(availableIds).not.toContain(7)
  expect(availableIds).not.toContain(9)

  // Invisible documents (Dept 2 doc 2 with no assignee, and Dept 1 doc created by admin) -> 404
  await expect(
    api.post('/dossiers/1/documents', { documentId: 2 }),
  ).rejects.toMatchObject({ response: { status: 404 } })
  await expect(
    api.post('/dossiers/1/documents', { documentId: adminDoc.data.id }),
  ).rejects.toMatchObject({ response: { status: 404 } })

  // Visible cross-dept document (doc 4 assigned to employee) -> 403
  documentStore.documents[3].assigneeIds = [3]
  await expect(
    api.post('/dossiers/1/documents', { documentId: 4 }),
  ).rejects.toMatchObject({ response: { status: 403 } })

  // Already attached to another dossier -> 409
  await expect(
    api.post('/dossiers/1/documents', { documentId: 9 }),
  ).rejects.toMatchObject({ response: { status: 409 } })

  // Re-attaching a document already in the same open dossier -> idempotent 200
  const reattached = await api.post('/dossiers/1/documents', { documentId: 7 })
  expect(reattached.status).toBe(200)
  expect(reattached.data.id).toBe(7)
  expect((await api.get('/dossiers/1')).data.documentCount).toBe(2)

  await api.post('/dossiers/1/documents', { documentId: 1 })
  expect((await api.get('/dossiers/1')).data.documentCount).toBe(3)

  await api.delete('/dossiers/1/documents/1')
  expect((await api.get('/dossiers/1')).data.documentCount).toBe(2)

  await expect(api.delete('/dossiers/1/documents/1')).rejects.toMatchObject({
    response: { status: 404 },
  })
})

it('enforces dossierId rules on document create/update and returns dossier summary on detail', async () => {
  await login('employee')
  const detail = await api.get('/documents/7')
  expect(detail.data.dossierId).toBe(1)
  expect(detail.data.dossier).toMatchObject({
    id: 1,
    code: 'HS-2026-01',
    closed: false,
  })

  const baseInput = {
    direction: 'INCOMING',
    summary: 'Draft with dossier',
    documentTypeId: 1,
    urgencyId: 4,
    confidentialityId: 7,
    issuingOrganizationId: 1,
    departmentId: 1,
  }

  await expect(
    api.post('/documents', { ...baseInput, dossierId: 9999 }),
  ).rejects.toMatchObject({ response: { status: 400 } })

  await expect(
    api.post('/documents', { ...baseInput, dossierId: 4 }),
  ).rejects.toMatchObject({ response: { status: 403 } })

  await expect(
    api.post('/documents', { ...baseInput, dossierId: 2 }),
  ).rejects.toMatchObject({ response: { status: 409 } })

  const created = await api.post('/documents', { ...baseInput, dossierId: 1 })
  expect(created.data.dossierId).toBe(1)
  expect((await api.get('/dossiers/1')).data.documentCount).toBe(2)

  await api.post('/dossiers/1/close')
  const updatedSameClosed = await api.put(`/documents/${created.data.id}`, {
    ...baseInput,
    summary: 'Updated while in closed dossier',
    dossierId: 1,
    version: created.data.version,
  })
  expect(updatedSameClosed.data.dossierId).toBe(1)

  await expect(
    api.put(`/documents/${created.data.id}`, {
      ...baseInput,
      dossierId: null,
      version: updatedSameClosed.data.version,
    }),
  ).rejects.toMatchObject({ response: { status: 409 } })
})
