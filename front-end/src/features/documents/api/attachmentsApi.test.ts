import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { delay, http, HttpResponse } from 'msw'
import {
  attachmentsApi,
  formatFileSize,
  isPreviewableMime,
  MAX_ATTACHMENT_BYTES,
  validateClientFile,
} from '@/features/documents/api/attachmentsApi.ts'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

it('lists, uploads, replaces, gets versions, gets signed URLs, and removes attachments', async () => {
  const sample = {
    id: 1,
    documentId: 5,
    fileGroupId: 'grp-1',
    fileName: 'memo.pdf',
    mimeType: 'application/pdf',
    fileSize: 120,
    versionNo: 1,
    isCurrent: true,
    uploadedBy: 1,
    uploadedAt: '2026-11-20T10:00:00Z',
  }
  let uploadedName = ''
  let replacedName = ''
  let requestedDisposition = ''
  server.use(
    http.get('/api/documents/5/attachments', () => HttpResponse.json([sample])),
    http.post('/api/documents/5/attachments', async ({ request }) => {
      const body = await request.text()
      uploadedName = /\bname="file";\s*filename="([^"]*)"/.exec(body)?.[1] ?? ''
      return HttpResponse.json(sample, { status: 201 })
    }),
    http.post('/api/documents/5/attachments/1/replace', async ({ request }) => {
      const body = await request.text()
      replacedName = /\bname="file";\s*filename="([^"]*)"/.exec(body)?.[1] ?? ''
      return HttpResponse.json({
        ...sample,
        id: 2,
        fileName: replacedName,
        versionNo: 2,
      })
    }),
    http.get('/api/documents/5/attachments/2/versions', () =>
      HttpResponse.json([
        { ...sample, id: 2, versionNo: 2 },
        { ...sample, isCurrent: false },
      ]),
    ),
    http.get('/api/documents/5/attachments/2/url', ({ request }) => {
      requestedDisposition =
        new URL(request.url).searchParams.get('disposition') ?? ''
      return HttpResponse.json({
        url: 'data:application/pdf;base64,JVBERg==',
        expiresAt: '2026-11-20T10:05:00Z',
        expiresInSeconds: 300,
        disposition: requestedDisposition,
      })
    }),
    http.delete(
      '/api/documents/5/attachments/2',
      () => new HttpResponse(null, { status: 204 }),
    ),
  )

  expect(await attachmentsApi.list(5)).toEqual([sample])
  const pdf = new File(['%PDF-1.4'], 'memo.pdf', { type: 'application/pdf' })
  await attachmentsApi.upload(5, pdf)
  expect(uploadedName).toBe('memo.pdf')

  const nextPdf = new File(['%PDF-1.5'], 'memo-v2.pdf', {
    type: 'application/pdf',
  })
  const replaced = await attachmentsApi.replace(5, 1, nextPdf)
  expect(replacedName).toBe('memo-v2.pdf')
  expect(replaced.versionNo).toBe(2)

  expect(await attachmentsApi.versions(5, 2)).toHaveLength(2)

  const signedInline = await attachmentsApi.getUrl(5, 2)
  expect(requestedDisposition).toBe('inline')
  expect(signedInline.disposition).toBe('inline')

  const signedDownload = await attachmentsApi.getUrl(5, 2, 'attachment')
  expect(requestedDisposition).toBe('attachment')
  expect(signedDownload.disposition).toBe('attachment')

  await expect(attachmentsApi.remove(5, 2)).resolves.toBeUndefined()
})

it('cancels a pending attachment request via AbortSignal', async () => {
  server.use(
    http.get('/api/documents/1/attachments', async () => {
      await delay(100)
      return HttpResponse.json([])
    }),
  )
  const controller = new AbortController()
  const pending = attachmentsApi.list(1, controller.signal)
  controller.abort()
  await expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' })
})

it('validates client file types, sizes, previewability, and formatting', () => {
  expect(
    validateClientFile(
      new File(['ok'], 'scan.pdf', { type: 'application/pdf' }),
    ),
  ).toBeNull()
  expect(
    validateClientFile(new File(['ok'], 'photo.webp', { type: 'image/webp' })),
  ).toBeNull()
  expect(validateClientFile(new File(['ok'], 'report.docx'))).toBeNull()
  expect(
    validateClientFile(
      new File(['ok'], 'report.docx', { type: 'application/octet-stream' }),
    ),
  ).toBeNull()
  expect(
    validateClientFile(new File([], 'empty.pdf', { type: 'application/pdf' })),
  ).toBe('File is empty.')
  expect(
    validateClientFile(
      new File(['bad'], 'script.exe', { type: 'application/octet-stream' }),
    ),
  ).toMatch(/Unsupported file type/)
  expect(
    validateClientFile(
      new File(['bad'], 'script.exe', { type: 'application/x-msdownload' }),
    ),
  ).toMatch(/Unsupported file type/)
  expect(
    validateClientFile(new File(['bad'], 'fake.pdf', { type: 'text/plain' })),
  ).toMatch(/Unsupported file type/)

  const oversized = new File(['x'], 'large.pdf', { type: 'application/pdf' })
  Object.defineProperty(oversized, 'size', { value: MAX_ATTACHMENT_BYTES + 1 })
  expect(validateClientFile(oversized)).toBe('File exceeds the 10 MB limit.')

  expect(isPreviewableMime('application/pdf')).toBe(true)
  expect(isPreviewableMime('image/png')).toBe(true)
  expect(isPreviewableMime('image/jpeg')).toBe(true)
  expect(isPreviewableMime('image/webp')).toBe(true)
  expect(isPreviewableMime('image/svg+xml')).toBe(false)
  expect(isPreviewableMime('image/gif')).toBe(false)
  expect(
    isPreviewableMime(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),
  ).toBe(false)

  expect(formatFileSize(0)).toBe('0 B')
  expect(formatFileSize(512)).toBe('512 B')
  expect(formatFileSize(2048)).toBe('2 KB')
  expect(formatFileSize(1536)).toBe('1.5 KB')
  expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB')
})
