import { http, HttpResponse } from 'msw'
import type { Role } from '@/shared/types/domain.ts'
import type { Dossier } from '@/features/dossiers/types.ts'
import type { DocumentDetail } from '@/features/documents/types.ts'
import { documentStore } from '@/mocks/documents.ts'

type Actor = { id: number; role: Role; departmentId: number | null }

interface DossierRecord {
  id: number
  code: string
  name: string
  year: number
  departmentId: number
  closed: boolean
  createdAt: string
}

function seed(): DossierRecord[] {
  return [
    {
      id: 1,
      code: 'HS-2026-01',
      name: 'Recruitment 2026',
      year: 2026,
      departmentId: 1,
      closed: false,
      createdAt: '2026-01-10T02:00:00Z',
    },
    {
      id: 2,
      code: 'HS-2026-02',
      name: 'Q1 Audit',
      year: 2026,
      departmentId: 1,
      closed: true,
      createdAt: '2026-01-15T02:00:00Z',
    },
    {
      id: 3,
      code: 'HS-2025-01',
      name: 'Annual Archive 2025',
      year: 2025,
      departmentId: 1,
      closed: false,
      createdAt: '2025-02-01T02:00:00Z',
    },
    {
      id: 4,
      code: 'HS-2026-01',
      name: 'Operations 2026',
      year: 2026,
      departmentId: 2,
      closed: false,
      createdAt: '2026-01-20T02:00:00Z',
    },
  ]
}

export const dossierStore = {
  dossiers: seed(),
  nextId: 5,
}

export function resetDossiers() {
  dossierStore.dossiers = seed()
  dossierStore.nextId = 5
}

const failure = (
  status: number,
  message: string,
  fieldErrors?: Record<string, string>,
) =>
  HttpResponse.json(
    { message, ...(fieldErrors ? { fieldErrors } : {}) },
    { status },
  )

const toDto = (dossier: DossierRecord): Dossier => ({
  ...dossier,
  documentCount: documentStore.documents.filter(
    (d) => d.dossierId === dossier.id,
  ).length,
})

const visibleDocument = (user: Actor, doc: DocumentDetail) =>
  (user.role === 'MANAGER' && user.departmentId === doc.departmentId) ||
  (user.role === 'EMPLOYEE' &&
    (user.id === doc.createdBy || doc.assigneeIds.includes(user.id)))

function validatePayload(body: Record<string, unknown>) {
  const errors: Record<string, string> = {}
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code || code.length > 50)
    errors.code = 'Enter a record code of 1–50 characters.'
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 255)
    errors.name = 'Enter a record name of 1–255 characters.'
  const year = body.year
  if (
    typeof year !== 'number' ||
    !Number.isSafeInteger(year) ||
    year < 1900 ||
    year > 2100
  )
    errors.year = 'Enter a year between 1900 and 2100.'
  if (Object.keys(errors).length)
    return failure(422, 'Check the fields below.', errors)
  return { code, name, year: year as number }
}

export function createDossierHandlers(
  base: string,
  getUser: (request: Request) => Actor | null,
) {
  function requireStaff(request: Request): Actor | Response {
    const user = getUser(request)
    if (!user) return failure(401, 'Please log in again.')
    if (user.role !== 'MANAGER' && user.role !== 'EMPLOYEE')
      return failure(403, 'You do not have permission to access records.')
    if (user.departmentId == null)
      return failure(403, 'Your account has no department.')
    return user
  }

  function authorizeDossier(request: Request, rawId: string) {
    const user = requireStaff(request)
    if (user instanceof Response) return user
    const id = Number(rawId)
    const dossier = Number.isSafeInteger(id)
      ? dossierStore.dossiers.find((d) => d.id === id)
      : undefined
    if (!dossier || dossier.departmentId !== user.departmentId)
      return failure(404, 'Record not found.')
    return { user, dossier }
  }

  return [
    http.get(`${base}/dossiers`, ({ request }) => {
      const user = requireStaff(request)
      if (user instanceof Response) return user
      const q = new URL(request.url).searchParams
      const page = Number(q.get('page') ?? 0)
      const size = Number(q.get('size') ?? 10)
      const rawYear = q.get('year')
      const rawClosed = q.get('closed')
      const year = rawYear !== null && rawYear !== '' ? Number(rawYear) : null
      if (
        !Number.isSafeInteger(page) ||
        page < 0 ||
        !Number.isSafeInteger(size) ||
        size < 1 ||
        size > 100 ||
        (year !== null &&
          (!Number.isSafeInteger(year) || year < 1900 || year > 2100)) ||
        (rawClosed !== null &&
          rawClosed !== '' &&
          rawClosed !== 'true' &&
          rawClosed !== 'false')
      )
        return failure(400, 'Invalid record query.')

      const closed =
        rawClosed === 'true' ? true : rawClosed === 'false' ? false : null
      const rows = dossierStore.dossiers
        .filter(
          (d) =>
            d.departmentId === user.departmentId &&
            (year === null || d.year === year) &&
            (closed === null || d.closed === closed),
        )
        .sort((a, b) => b.year - a.year || b.id - a.id)
        .map(toDto)

      return HttpResponse.json({
        content: rows.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: rows.length,
        totalPages: Math.ceil(rows.length / size),
      })
    }),

    http.get(`${base}/dossiers/:id`, ({ request, params }) => {
      const checked = authorizeDossier(request, String(params.id))
      return checked instanceof Response
        ? checked
        : HttpResponse.json(toDto(checked.dossier))
    }),

    http.post(`${base}/dossiers`, async ({ request }) => {
      const user = requireStaff(request)
      if (user instanceof Response) return user
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return failure(400, 'Invalid request.')
      const parsed = validatePayload(body as Record<string, unknown>)
      if (parsed instanceof Response) return parsed

      if (
        dossierStore.dossiers.some(
          (d) =>
            d.departmentId === user.departmentId &&
            d.year === parsed.year &&
            d.code.trim().toLowerCase() === parsed.code.toLowerCase(),
        )
      ) {
        return failure(
          409,
          `Record code ${parsed.code} already exists for year ${parsed.year}.`,
          { code: 'This record code already exists for this year.' },
        )
      }

      const created: DossierRecord = {
        id: dossierStore.nextId++,
        code: parsed.code,
        name: parsed.name,
        year: parsed.year,
        departmentId: user.departmentId!,
        closed: false,
        createdAt: new Date().toISOString(),
      }
      dossierStore.dossiers.push(created)
      return HttpResponse.json(toDto(created), { status: 201 })
    }),

    http.put(`${base}/dossiers/:id`, async ({ request, params }) => {
      const checked = authorizeDossier(request, String(params.id))
      if (checked instanceof Response) return checked
      const { user, dossier } = checked
      if (dossier.closed)
        return failure(409, 'Closed records cannot be modified.')
      const body = await request.json().catch(() => null)
      if (!body || typeof body !== 'object' || Array.isArray(body))
        return failure(400, 'Invalid request.')
      const parsed = validatePayload(body as Record<string, unknown>)
      if (parsed instanceof Response) return parsed

      if (
        dossierStore.dossiers.some(
          (d) =>
            d.id !== dossier.id &&
            d.departmentId === user.departmentId &&
            d.year === parsed.year &&
            d.code.trim().toLowerCase() === parsed.code.toLowerCase(),
        )
      ) {
        return failure(
          409,
          `Record code ${parsed.code} already exists for year ${parsed.year}.`,
          { code: 'This record code already exists for this year.' },
        )
      }

      dossier.code = parsed.code
      dossier.name = parsed.name
      dossier.year = parsed.year
      return HttpResponse.json(toDto(dossier))
    }),

    http.post(`${base}/dossiers/:id/close`, ({ request, params }) => {
      const checked = authorizeDossier(request, String(params.id))
      if (checked instanceof Response) return checked
      if (checked.dossier.closed)
        return failure(409, 'This record is already closed.')
      checked.dossier.closed = true
      return HttpResponse.json(toDto(checked.dossier))
    }),

    http.get(`${base}/dossiers/:id/documents`, ({ request, params }) => {
      const checked = authorizeDossier(request, String(params.id))
      if (checked instanceof Response) return checked
      const docs = documentStore.documents
        .filter(
          (d) =>
            d.dossierId === checked.dossier.id &&
            visibleDocument(checked.user, d),
        )
        .sort((a, b) => b.id - a.id)
      return HttpResponse.json(docs)
    }),

    http.get(
      `${base}/dossiers/:id/available-documents`,
      ({ request, params }) => {
        const checked = authorizeDossier(request, String(params.id))
        if (checked instanceof Response) return checked
        const docs = documentStore.documents
          .filter(
            (d) =>
              d.dossierId == null &&
              d.departmentId === checked.dossier.departmentId &&
              visibleDocument(checked.user, d),
          )
          .sort((a, b) => b.id - a.id)
        return HttpResponse.json(docs)
      },
    ),

    http.post(`${base}/dossiers/:id/documents`, async ({ request, params }) => {
      const checked = authorizeDossier(request, String(params.id))
      if (checked instanceof Response) return checked
      const { user, dossier } = checked
      if (dossier.closed)
        return failure(409, 'Cannot attach documents to a closed record.')
      const body = (await request.json().catch(() => null)) as {
        documentId?: unknown
      } | null
      const docId = body?.documentId
      if (
        typeof docId !== 'number' ||
        !Number.isSafeInteger(docId) ||
        docId <= 0
      )
        return failure(400, 'Select a valid document.')
      const doc = documentStore.documents.find((d) => d.id === docId)
      if (!doc || !visibleDocument(user, doc))
        return failure(404, 'Document not found.')
      if (doc.departmentId !== dossier.departmentId)
        return failure(403, 'Document belongs to a different department.')
      if (doc.dossierId === dossier.id) return HttpResponse.json(doc)
      if (doc.dossierId != null)
        return failure(409, 'Document is already attached to another record.')
      doc.dossierId = dossier.id
      return HttpResponse.json(doc)
    }),

    http.delete(
      `${base}/dossiers/:id/documents/:documentId`,
      ({ request, params }) => {
        const checked = authorizeDossier(request, String(params.id))
        if (checked instanceof Response) return checked
        if (checked.dossier.closed)
          return failure(409, 'Cannot detach documents from a closed record.')
        const docId = Number(params.documentId)
        const doc = Number.isSafeInteger(docId)
          ? documentStore.documents.find((d) => d.id === docId)
          : undefined
        if (!doc || doc.dossierId !== checked.dossier.id)
          return failure(404, 'Document is not attached to this record.')
        doc.dossierId = null
        return new HttpResponse(null, { status: 204 })
      },
    ),
  ]
}
