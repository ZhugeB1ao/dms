import { http, HttpResponse } from 'msw'
import {
  canViewDocument,
  canRunWorkflowAction,
  hasWorkflowAuthority,
  workflowSourceStatus,
} from '@/features/documents/permissions.ts'
import { documentDirections } from '@/features/documents/types.ts'
import type {
  DocumentDetail,
  WorkflowCommand,
} from '@/features/documents/types.ts'
import type { MockAccount } from '@/mocks/handlers.ts'
import { documentStore } from '@/mocks/documents.ts'

const nextStatus: Record<WorkflowCommand['action'], string> = {
  submit: 'PENDING_APPROVAL',
  approve: 'READY_TO_PUBLISH',
  reject: 'REJECTED',
  publish: 'PUBLISHED',
  recall: 'RECALLED',
}

const failure = (
  status: number,
  message: string,
  fieldErrors?: Record<string, string>,
) => HttpResponse.json({ message, fieldErrors }, { status })

const asUser = (actor: MockAccount) => ({
  id: String(actor.id),
  roles: [actor.role],
  departmentId: actor.departmentId === null ? null : String(actor.departmentId),
})

export function withMockPublicationPermission(
  doc: DocumentDetail,
  actor: { id: number; departmentId: number | null },
) {
  return {
    ...doc,
    canPublish: actor.id === 2 && doc.departmentId === actor.departmentId,
  }
}

export function createDocumentWorkflowHandlers(
  base: string,
  getActor: (request: Request) => MockAccount | null,
  getAccounts: () => MockAccount[],
) {
  function resolve(request: Request, id: string) {
    const actor = getActor(request)
    if (!actor) return failure(401, 'Please log in again.')
    const doc = documentStore.documents.find((row) => String(row.id) === id)
    if (!doc) return failure(404, 'Document not found.')
    const user = asUser(actor)
    if (!canViewDocument(user, doc)) return failure(403, 'Forbidden.')
    return { actor, user, doc }
  }

  const reviewersFor = (doc: DocumentDetail) =>
    getAccounts().filter(
      (actor) =>
        actor.active &&
        actor.role === 'MANAGER' &&
        actor.departmentId === doc.departmentId,
    )

  return [
    http.get(`${base}/documents/pending-approvals`, ({ request }) => {
      const actor = getActor(request)
      if (!actor) return failure(401, 'Please log in again.')
      if (actor.role !== 'MANAGER') return failure(403, 'Forbidden.')
      const params = new URL(request.url).searchParams
      const page = Number(params.get('page') ?? 0)
      const size = Number(params.get('size') ?? 10)
      const direction = params.get('direction')
      const type = params.get('documentTypeId')
      if (
        !Number.isSafeInteger(page) ||
        page < 0 ||
        ![10, 20, 50].includes(size) ||
        (direction !== null && !Object.hasOwn(documentDirections, direction)) ||
        (type !== null &&
          (!Number.isSafeInteger(Number(type)) || Number(type) < 1))
      )
        return failure(400, 'Invalid approval query.')
      const user = asUser(actor)
      const pending = documentStore.documents.filter((doc) =>
        canRunWorkflowAction(user, doc, 'approve'),
      )
      const filtered = pending
        .filter(
          (doc) =>
            (!direction || doc.direction === direction) &&
            (!type || doc.documentTypeId === Number(type)),
        )
        .sort(
          (a, b) =>
            (b.submittedAt ?? b.updatedAt).localeCompare(
              a.submittedAt ?? a.updatedAt,
            ) || b.id - a.id,
        )
      return HttpResponse.json({
        content: filtered.slice(page * size, (page + 1) * size).map((doc) => ({
          ...doc,
          submittedAt: doc.submittedAt ?? doc.updatedAt,
          submittedByName: doc.submittedByName ?? `User ${doc.createdBy}`,
        })),
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size),
        pendingCount: pending.length,
        page,
        size,
      })
    }),
    http.get(
      `${base}/documents/:id/workflow/reviewers`,
      ({ request, params }) => {
        const result = resolve(request, String(params.id))
        if (result instanceof Response) return result
        if (!canRunWorkflowAction(result.user, result.doc, 'submit'))
          return failure(403, 'Forbidden.')
        return HttpResponse.json(
          reviewersFor(result.doc).map(({ id, username }) => ({
            id,
            name: username,
          })),
        )
      },
    ),
    http.post(
      `${base}/documents/:id/workflow/transition`,
      async ({ request, params }) => {
        const body = (await request.json().catch(() => null)) as Record<
          string,
          unknown
        > | null
        const result = resolve(request, String(params.id))
        if (result instanceof Response) return result
        if (
          typeof body?.action !== 'string' ||
          !Object.hasOwn(nextStatus, body.action) ||
          !Number.isSafeInteger(body.version)
        )
          return failure(400, 'Invalid workflow request.')
        const action = body.action as WorkflowCommand['action']
        const { actor, user, doc } = result
        if (
          !hasWorkflowAuthority(
            user,
            withMockPublicationPermission(doc, actor),
            action,
          )
        )
          return failure(403, 'Forbidden.')
        if (
          doc.version !== body.version ||
          doc.status !== workflowSourceStatus[action]
        )
          return failure(409, 'The document changed. Reload before continuing.')
        const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
        if ((action === 'reject' || action === 'recall') && !reason)
          return failure(422, 'A reason is required.', {
            reason: 'Enter a reason.',
          })
        const now = new Date().toISOString()
        let note: string | undefined
        if (action === 'submit') {
          const reviewer = reviewersFor(doc).find(
            (candidate) => candidate.id === body.reviewerId,
          )
          if (!reviewer)
            return failure(422, 'Choose a reviewer.', {
              reviewerId: 'Choose an eligible reviewer.',
            })
          doc.reviewerId = reviewer.id
          doc.reviewerName = reviewer.username
          doc.submittedByName = actor.username
          doc.submittedAt = now
          note = `Reviewer: ${reviewer.username}`
        }
        if (action === 'publish') {
          doc.documentNumber = `${documentStore.nextDocumentNumber++}/${now.slice(0, 4)}/CV`
          note = doc.documentNumber
        }
        if (action === 'reject' || action === 'recall') note = reason

        const history = documentStore.histories.get(doc.id) ?? []
        documentStore.histories.set(doc.id, [
          ...history,
          {
            id: (history.at(-1)?.id ?? 0) + 1,
            fromStatus: doc.status,
            toStatus: nextStatus[action],
            action,
            actorName: actor.username,
            occurredAt: now,
            note,
          },
        ])
        doc.status = nextStatus[action]
        doc.version += 1
        doc.updatedAt = now
        return HttpResponse.json(withMockPublicationPermission(doc, actor))
      },
    ),
  ]
}
