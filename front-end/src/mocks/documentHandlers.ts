import { http, HttpResponse, passthrough } from 'msw'
import type { Role } from '@/shared/types/domain.ts'
import type {
  DocumentDetail,
  DraftInput,
  Lookup,
} from '@/features/documents/types.ts'
import { documentStore } from '@/mocks/documents.ts'

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
      return checked instanceof Response
        ? checked
        : HttpResponse.json(
            checked.doc.id <= 90
              ? [
                  {
                    id: 1,
                    fileName: 'Sample document.pdf',
                    sizeBytes: 2048,
                    contentType: 'application/pdf',
                    uploadedBy: 'Demo author',
                    uploadedAt: checked.doc.createdAt,
                  },
                ]
              : [],
          )
    }),
  ]
}
