import { http, HttpResponse, passthrough } from 'msw'
import type { Role } from '@/shared/types/domain.ts'
import type {
  DocumentAttachment,
  DocumentDetail,
  DraftInput,
  Lookup,
} from '@/features/documents/types.ts'
import {
  isPreviewableMime,
  MAX_ATTACHMENT_BYTES,
  resolveAttachmentMime,
} from '@/features/documents/api/attachmentsApi.ts'
import { documentStore } from '@/mocks/documents.ts'

const SAMPLE_PDF_DATA_URL =
  'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8Pj5lbmRvYmoKdHJhaWxlcjw8Pj4KJSVFT0Y='
const SAMPLE_IMAGE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

type UploadedFileLike = {
  name?: string
  size: number
  type?: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

function bytesToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

type Actor = { id: number; role: Role; departmentId: number | null }
type Catalogs = {
  categories: (Lookup & { type: string })[]
  departments: Lookup[]
  organizations: Lookup[]
}
const failure = (
  status: number,
  message: string,
  fieldErrors?: Record<string, string>,
) => HttpResponse.json({ message, fieldErrors }, { status })
const visible = (u: Actor, d: DocumentDetail) =>
  u.role === 'ADMIN' ||
  (u.role === 'MANAGER' && u.departmentId === d.departmentId) ||
  (u.role === 'EMPLOYEE' &&
    (u.id === d.createdBy || d.assigneeIds.includes(u.id)))
const editable = (u: Actor, d: DocumentDetail) =>
  visible(u, d) && (u.role !== 'EMPLOYEE' || u.id === d.createdBy)

export function createDocumentHandlers(
  base: string,
  getUser: (request: Request) => Actor | null,
  catalogs: () => Catalogs,
) {
  function authorize(request: Request, id: string) {
    const user = getUser(request)
    if (!user) return failure(401, 'Please log in again.')
    const doc = documentStore.documents.find((d) => String(d.id) === id)
    if (!doc) return failure(404, 'Document not found.')
    if (!visible(user, doc))
      return failure(403, 'You do not have permission to view this document.')
    return { user, doc }
  }
  function authorizeAttachmentWrite(request: Request, id: string) {
    const checked = authorize(request, id)
    if (checked instanceof Response) return checked
    if (!editable(checked.user, checked.doc))
      return failure(403, 'You do not have permission to manage attachments.')
    if (checked.doc.status !== 'DRAFT')
      return failure(
        409,
        'Attachments can only be changed while the document is in DRAFT status.',
      )
    return checked
  }
  function findAttachment(docId: number, rawAttachmentId: string) {
    const list = documentStore.attachments.get(docId) ?? []
    const attachmentId = Number(rawAttachmentId)
    const target = Number.isSafeInteger(attachmentId)
      ? list.find((item) => item.id === attachmentId)
      : undefined
    return { list, target }
  }
  function validate(
    body: Record<string, unknown>,
    user: Actor,
    old?: DocumentDetail,
  ) {
    const errors: Record<string, string> = {}
    if (
      !['INCOMING', 'OUTGOING', 'INTERNAL'].includes(String(body.direction)) ||
      (old && body.direction !== old.direction)
    )
      errors.direction = 'Choose a valid direction.'
    const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
    if (!summary || summary.length > 1000)
      errors.summary = 'Enter a summary of 1–1000 characters.'
    const c = catalogs()
    const fields = [
      [
        'documentTypeId',
        'documentType',
        c.categories.filter((x) => x.type === 'DOC_TYPE'),
      ],
      [
        'urgencyId',
        'urgency',
        c.categories.filter((x) => x.type === 'URGENCY'),
      ],
      [
        'confidentialityId',
        'confidentiality',
        c.categories.filter((x) => x.type === 'CONFIDENTIALITY'),
      ],
      ['issuingOrganizationId', 'issuingOrganization', c.organizations],
      ['departmentId', 'department', c.departments],
    ] as const
    const lookups = {} as DocumentDetail['lookups']
    for (const [field, key, options] of fields) {
      const option = options.find((x) => x.id === body[field])
      if (!option || (!option.isActive && old?.[field] !== option.id))
        errors[field] = 'Choose an active option.'
      else
        lookups[key] = {
          id: option.id,
          name: option.name,
          isActive: option.isActive,
        }
    }
    if (Object.keys(errors).length)
      return failure(422, 'Check the fields below.', errors)
    if (
      user.role !== 'ADMIN' &&
      body.departmentId !== (old?.departmentId ?? user.departmentId)
    )
      return failure(403, 'You cannot change the responsible department.')
    return {
      direction: body.direction as DraftInput['direction'],
      summary,
      documentTypeId: lookups.documentType.id,
      urgencyId: lookups.urgency.id,
      confidentialityId: lookups.confidentiality.id,
      issuingOrganizationId: lookups.issuingOrganization.id,
      departmentId: lookups.department.id,
      documentTypeName: lookups.documentType.name,
      issuingOrganizationName: lookups.issuingOrganization.name,
      departmentName: lookups.department.name,
      lookups,
    }
  }
  return [
    http.get(`${base}/documents`, ({ request }) => {
      const user = getUser(request)
      if (!user) return failure(401, 'Please log in again.')
      const q = new URL(request.url).searchParams
      // No `direction` = the OCR page's flat `GET /documents`, not this feature.
      if (!q.has('direction')) return passthrough()
      const direction = q.get('direction'),
        page = Number(q.get('page') ?? 0),
        size = Number(q.get('size') ?? 10)
      if (
        !['INCOMING', 'OUTGOING', 'INTERNAL'].includes(direction ?? '') ||
        !Number.isSafeInteger(page) ||
        page < 0 ||
        ![10, 20, 50].includes(size) ||
        ['departmentId', 'documentTypeId'].some(
          (k) =>
            q.has(k) &&
            (!Number.isSafeInteger(Number(q.get(k))) || Number(q.get(k)) <= 0),
        )
      )
        return failure(400, 'Invalid document query.')
      const rows = documentStore.documents
        .filter(
          (d) =>
            visible(user, d) &&
            d.direction === direction &&
            (!q.get('status') || d.status === q.get('status')) &&
            (!q.get('departmentId') ||
              d.departmentId === Number(q.get('departmentId'))) &&
            (!q.get('documentTypeId') ||
              d.documentTypeId === Number(q.get('documentTypeId'))),
        )
        .sort((a, b) => b.id - a.id)
      return HttpResponse.json({
        content: rows.slice(page * size, (page + 1) * size),
        totalElements: rows.length,
        totalPages: Math.ceil(rows.length / size),
        page,
        size,
      })
    }),
    http.get(`${base}/documents/:id`, ({ request, params }) => {
      const checked = authorize(request, String(params.id))
      if (checked instanceof Response) return checked
      const c = catalogs()
      const lookups = { ...checked.doc.lookups }
      for (const key of Object.keys(
        lookups,
      ) as (keyof DocumentDetail['lookups'])[]) {
        const options =
          key === 'department'
            ? c.departments
            : key === 'issuingOrganization'
              ? c.organizations
              : c.categories
        const current = options.find((option) => option.id === lookups[key].id)
        lookups[key] = current
          ? { id: current.id, name: current.name, isActive: current.isActive }
          : { ...lookups[key], isActive: false }
      }
      return HttpResponse.json({ ...checked.doc, lookups })
    }),
    http.post(`${base}/documents`, async ({ request }) => {
      const user = getUser(request)
      if (!user) return failure(401, 'Please log in again.')
      if (!['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(user.role))
        return failure(403, 'Forbidden.')
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return failure(400, 'Invalid request.')
      const fields = validate(body as Record<string, unknown>, user)
      if (fields instanceof Response) return fields
      const now = new Date().toISOString()
      const doc: DocumentDetail = {
        ...fields,
        id: documentStore.nextId++,
        createdBy: user.id,
        assigneeIds: [],
        status: 'DRAFT',
        version: 1,
        createdAt: now,
        updatedAt: now,
      }
      documentStore.documents.push(doc)
      documentStore.histories.set(doc.id, [
        {
          id: 1,
          fromStatus: null,
          toStatus: 'DRAFT',
          actorName: `User ${user.id}`,
          occurredAt: now,
        },
      ])
      return HttpResponse.json(doc, { status: 201 })
    }),
    http.put(`${base}/documents/:id`, async ({ request, params }) => {
      const checked = authorize(request, String(params.id))
      if (checked instanceof Response) return checked
      const { user, doc } = checked
      if (!editable(user, doc))
        return failure(403, 'You cannot edit this document.')
      const body = (await request.json().catch(() => null)) as Record<
        string,
        unknown
      > | null
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return failure(400, 'Invalid request.')
      if (doc.status !== 'DRAFT' || body.version !== doc.version)
        return failure(409, 'The document changed. Reload before continuing.')
      const fields = validate(body, user, doc)
      if (fields instanceof Response) return fields
      Object.assign(doc, fields, {
        version: doc.version + 1,
        updatedAt: new Date().toISOString(),
      })
      return HttpResponse.json(doc)
    }),
    http.delete(`${base}/documents/:id`, ({ request, params }) => {
      const checked = authorize(request, String(params.id))
      if (checked instanceof Response) return checked
      const { user, doc } = checked
      if (!editable(user, doc))
        return failure(403, 'You cannot delete this document.')
      if (
        doc.status !== 'DRAFT' ||
        Number(new URL(request.url).searchParams.get('version')) !== doc.version
      )
        return failure(409, 'The document changed. Reload before continuing.')
      documentStore.documents = documentStore.documents.filter(
        (d) => d.id !== doc.id,
      )
      documentStore.histories.delete(doc.id)
      documentStore.attachments.delete(doc.id)
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(`${base}/documents/:id/history`, ({ request, params }) => {
      const checked = authorize(request, String(params.id))
      return checked instanceof Response
        ? checked
        : HttpResponse.json(documentStore.histories.get(checked.doc.id) ?? [])
    }),
    http.get(`${base}/documents/:id/attachments`, ({ request, params }) => {
      const checked = authorize(request, String(params.id))
      if (checked instanceof Response) return checked
      const current = (
        documentStore.attachments.get(checked.doc.id) ?? []
      ).filter((item) => item.isCurrent)
      return HttpResponse.json(current)
    }),
    http.get(
      `${base}/documents/:id/attachments/:attachmentId/versions`,
      ({ request, params }) => {
        const checked = authorize(request, String(params.id))
        if (checked instanceof Response) return checked
        const { list, target } = findAttachment(
          checked.doc.id,
          String(params.attachmentId),
        )
        if (!target) return failure(404, 'Attachment not found.')
        return HttpResponse.json(
          list
            .filter((item) => item.fileGroupId === target.fileGroupId)
            .sort((a, b) => b.versionNo - a.versionNo),
        )
      },
    ),
    http.post(
      `${base}/documents/:id/attachments`,
      async ({ request, params }) => {
        const checked = authorizeAttachmentWrite(request, String(params.id))
        if (checked instanceof Response) return checked
        const uploaded = await readUploadedAttachment(request)
        if (uploaded instanceof Response) return uploaded
        const id = documentStore.nextAttachmentId++
        const created: DocumentAttachment = {
          id,
          documentId: checked.doc.id,
          fileGroupId: `group-${id}`,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          fileSize: uploaded.fileSize,
          versionNo: 1,
          isCurrent: true,
          uploadedBy: checked.user.id,
          uploadedAt: new Date().toISOString(),
        }
        const list = documentStore.attachments.get(checked.doc.id) ?? []
        list.push(created)
        documentStore.attachments.set(checked.doc.id, list)
        documentStore.attachmentDataUrls.set(id, uploaded.dataUrl)
        return HttpResponse.json(created, { status: 201 })
      },
    ),
    http.post(
      `${base}/documents/:id/attachments/:attachmentId/replace`,
      async ({ request, params }) => {
        const checked = authorizeAttachmentWrite(request, String(params.id))
        if (checked instanceof Response) return checked
        const { list, target } = findAttachment(
          checked.doc.id,
          String(params.attachmentId),
        )
        if (!target) return failure(404, 'Attachment not found.')
        const uploaded = await readUploadedAttachment(request)
        if (uploaded instanceof Response) return uploaded
        let maxVersion = 0
        for (const item of list) {
          if (item.fileGroupId === target.fileGroupId) {
            maxVersion = Math.max(maxVersion, item.versionNo)
            item.isCurrent = false
          }
        }
        const id = documentStore.nextAttachmentId++
        const created: DocumentAttachment = {
          id,
          documentId: checked.doc.id,
          fileGroupId: target.fileGroupId,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          fileSize: uploaded.fileSize,
          versionNo: maxVersion + 1,
          isCurrent: true,
          uploadedBy: checked.user.id,
          uploadedAt: new Date().toISOString(),
        }
        list.push(created)
        documentStore.attachments.set(checked.doc.id, list)
        documentStore.attachmentDataUrls.set(id, uploaded.dataUrl)
        return HttpResponse.json(created, { status: 201 })
      },
    ),
    http.delete(
      `${base}/documents/:id/attachments/:attachmentId`,
      ({ request, params }) => {
        const checked = authorizeAttachmentWrite(request, String(params.id))
        if (checked instanceof Response) return checked
        const { list, target } = findAttachment(
          checked.doc.id,
          String(params.attachmentId),
        )
        if (!target) return failure(404, 'Attachment not found.')
        documentStore.attachments.set(
          checked.doc.id,
          list.filter((item) => {
            if (item.fileGroupId === target.fileGroupId) {
              documentStore.attachmentDataUrls.delete(item.id)
              return false
            }
            return true
          }),
        )
        return new HttpResponse(null, { status: 204 })
      },
    ),
    http.get(
      `${base}/documents/:id/attachments/:attachmentId/url`,
      ({ request, params }) => {
        const checked = authorize(request, String(params.id))
        if (checked instanceof Response) return checked
        const { target } = findAttachment(
          checked.doc.id,
          String(params.attachmentId),
        )
        if (!target) return failure(404, 'Attachment not found.')
        const rawDisposition =
          new URL(request.url).searchParams.get('disposition') ?? 'inline'
        if (rawDisposition !== 'inline' && rawDisposition !== 'attachment') {
          return failure(400, 'Invalid disposition.')
        }
        const disposition =
          rawDisposition === 'inline' && !isPreviewableMime(target.mimeType)
            ? 'attachment'
            : rawDisposition
        const url =
          documentStore.attachmentDataUrls.get(target.id) ??
          (target.mimeType === 'application/pdf'
            ? SAMPLE_PDF_DATA_URL
            : target.mimeType.startsWith('image/')
              ? SAMPLE_IMAGE_DATA_URL
              : `data:${target.mimeType};charset=utf-8,attachment-${target.id}`)
        const expiresInSeconds = 300
        return HttpResponse.json({
          url,
          expiresAt: new Date(
            Date.now() + expiresInSeconds * 1000,
          ).toISOString(),
          expiresInSeconds,
          disposition,
        })
      },
    ),
  ]
}

async function parseMultipartFile(
  request: Request,
  fieldName = 'file',
): Promise<UploadedFileLike | null> {
  const contentType = request.headers.get('content-type') ?? ''
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType)
  if (!match) return null
  const boundary = match[1] || match[2]
  const bytes = new Uint8Array(await request.arrayBuffer())
  const raw = new TextDecoder('latin1').decode(bytes)
  const marker = `--${boundary}`
  let pos = raw.indexOf(marker)
  while (pos !== -1) {
    pos += marker.length
    if (raw.startsWith('--', pos)) break
    if (raw.startsWith('\r\n', pos)) pos += 2
    const headerEnd = raw.indexOf('\r\n\r\n', pos)
    if (headerEnd === -1) break
    const headerText = new TextDecoder('utf-8').decode(
      bytes.subarray(pos, headerEnd),
    )
    const bodyStart = headerEnd + 4
    const nextBoundary = raw.indexOf(`\r\n${marker}`, bodyStart)
    if (nextBoundary === -1) break
    const nameMatch = /\bname="([^"]+)"/i.exec(headerText)
    if (nameMatch?.[1] === fieldName) {
      const fileMatch = /\bfilename="([^"]*)"/i.exec(headerText)
      const typeMatch = /^content-type:\s*([^\r\n;]+)/im.exec(headerText)
      const slice = bytes.slice(bodyStart, nextBoundary)
      return {
        name: fileMatch?.[1] ?? 'attachment',
        size: slice.byteLength,
        type: typeMatch?.[1]?.trim() ?? '',
        arrayBuffer: async () => slice.buffer,
      }
    }
    pos = nextBoundary + 2
  }
  return null
}

async function readUploadedAttachment(request: Request) {
  let file: UploadedFileLike | null = null
  try {
    const formData = await request.clone().formData()
    const entry = formData.get('file')
    if (
      entry &&
      typeof entry !== 'string' &&
      typeof (entry as UploadedFileLike).size === 'number'
    ) {
      file = entry as UploadedFileLike
    }
  } catch {
    file = await parseMultipartFile(request, 'file')
  }
  if (!file) {
    return failure(400, 'File is required.')
  }
  if (file.size <= 0) {
    return failure(400, 'File must not be empty.')
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return failure(413, 'File exceeds the 10 MB limit.')
  }
  const fileName = file.name || 'attachment'
  const mimeType = resolveAttachmentMime(fileName, file.type ?? '')
  if (!mimeType) {
    return failure(
      415,
      'Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOCX, XLSX.',
    )
  }
  const buffer = await file.arrayBuffer()
  return {
    fileName,
    mimeType,
    fileSize: file.size,
    dataUrl: bytesToDataUrl(buffer, mimeType),
  }
}
