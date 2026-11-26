import { api } from '@/shared/api/http.ts'
import type {
  DocumentDetail,
  PendingApprovals,
  PendingQuery,
  Reviewer,
  WorkflowCommand,
} from '@/features/documents/types.ts'

export const documentWorkflowApi = {
  reviewers: (id: number, signal?: AbortSignal) =>
    api
      .get<Reviewer[]>(`/documents/${id}/workflow/reviewers`, { signal })
      .then((response) => response.data),
  pending: (params: PendingQuery, signal?: AbortSignal) =>
    api
      .get<PendingApprovals>('/documents/pending-approvals', { params, signal })
      .then(({ data }) => {
        if (
          !Array.isArray(data?.content) ||
          !Number.isFinite(data.pendingCount)
        )
          throw new Error('Unexpected pending approvals response')
        return data
      }),
  transition: (id: number, command: WorkflowCommand, signal?: AbortSignal) =>
    api
      .post<DocumentDetail>(`/documents/${id}/workflow/transition`, command, {
        signal,
      })
      .then((response): DocumentDetail | null =>
        response.status === 204 ? null : response.data,
      ),
}
