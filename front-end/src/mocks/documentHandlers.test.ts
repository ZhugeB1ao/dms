import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from '@/mocks/handlers.ts'
import { api, authHttp, session } from '@/shared/api/http.ts'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import {
  attachmentsApi,
  MAX_ATTACHMENT_BYTES,
} from '@/features/documents/api/attachmentsApi.ts'
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
it('uploads, replaces, lists versions, enforces limits/types/scopes, and deletes attachments', async () => {
  await login()
  const doc = await documentsApi.create(input)
  expect(await attachmentsApi.list(doc.id)).toEqual([])

  const v1 = await attachmentsApi.upload(
    doc.id,
    new File(['%PDF-1.4'], 'draft.pdf', { type: 'application/pdf' }),
  )
  expect(v1).toMatchObject({
    documentId: doc.id,
    fileName: 'draft.pdf',
    versionNo: 1,
    isCurrent: true,
  })

  const v2 = await attachmentsApi.replace(
    doc.id,
    v1.id,
    new File(['%PDF-1.5'], 'revised.pdf', { type: 'application/pdf' }),
  )
  expect(v2).toMatchObject({
    fileGroupId: v1.fileGroupId,
    fileName: 'revised.pdf',
    versionNo: 2,
    isCurrent: true,
  })
  expect(await attachmentsApi.list(doc.id)).toHaveLength(1)

  const versions = await attachmentsApi.versions(doc.id, v2.id)
  expect(versions).toHaveLength(2)
  expect(versions[0]).toMatchObject({
    id: v2.id,
    versionNo: 2,
    isCurrent: true,
  })
  expect(versions[1]).toMatchObject({
    id: v1.id,
    versionNo: 1,
    isCurrent: false,
  })

  const docx = await attachmentsApi.upload(
    doc.id,
    new File(['docx'], 'notes.docx', {
      type: 'application/octet-stream',
    }),
  )
  expect(docx.mimeType).toBe(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  const signedPdf = await attachmentsApi.getUrl(doc.id, v2.id, 'inline')
  expect(signedPdf.url.startsWith('data:application/pdf')).toBe(true)
  expect(signedPdf.expiresInSeconds).toBe(300)
  expect(signedPdf.disposition).toBe('inline')

  const signedDocx = await attachmentsApi.getUrl(doc.id, docx.id, 'inline')
  expect(signedDocx.disposition).toBe('attachment')

  await expect(
    attachmentsApi.upload(
      doc.id,
      new File([], 'empty.pdf', { type: 'application/pdf' }),
    ),
  ).rejects.toMatchObject({
    response: { status: 400, data: { message: 'File must not be empty.' } },
  })

  await expect(
    attachmentsApi.upload(
      doc.id,
      new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'huge.pdf', {
        type: 'application/pdf',
      }),
    ),
  ).rejects.toMatchObject({ response: { status: 413 } })

  await expect(
    attachmentsApi.upload(
      doc.id,
      new File(['MZ'], 'bad.exe', { type: 'application/x-msdownload' }),
    ),
  ).rejects.toMatchObject({ response: { status: 415 } })

  await login('employee')
  await expect(
    attachmentsApi.getUrl(doc.id, v2.id, 'inline'),
  ).rejects.toMatchObject({ response: { status: 403 } })

  await login()
  await expect(attachmentsApi.remove(3, 3)).rejects.toMatchObject({
    response: { status: 409 },
  })

  await attachmentsApi.remove(doc.id, v2.id)
  expect(await attachmentsApi.list(doc.id)).toEqual([docx])
})
