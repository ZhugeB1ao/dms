import { api } from '@/shared/api/http.ts'
import type {
  DocumentAttachment,
  DocumentDetail,
  DocumentPage,
  DocumentQuery,
  DraftInput,
  StatusHistoryEntry,
} from '@/features/documents/types.ts'
export const documentsApi = {
  list: (params: DocumentQuery, signal?: AbortSignal) =>
    api.get<DocumentPage>('/documents', { params, signal }).then((r) => {
      // /api/documents is shared with the OCR file-service, which returns a bare array.
      if (
        !Array.isArray(r.data?.content) ||
        !Number.isFinite(r.data.totalPages)
      )
        throw new Error('Unexpected /documents response')
      return r.data
    }),
  get: (id: number, signal?: AbortSignal) =>
    api.get<DocumentDetail>(`/documents/${id}`, { signal }).then((r) => r.data),
  create: (input: DraftInput, signal?: AbortSignal) =>
    api
      .post<DocumentDetail>('/documents', input, { signal })
      .then((r) => r.data),
  update: (
    id: number,
    input: DraftInput & { version: number },
    signal?: AbortSignal,
  ) =>
    api
      .put<DocumentDetail>(`/documents/${id}`, input, { signal })
      .then((r) => r.data),
  remove: async (
    id: number,
    version: number,
    signal?: AbortSignal,
  ): Promise<void> => {
    await api.delete(`/documents/${id}`, { params: { version }, signal })
  },
  history: (id: number, signal?: AbortSignal) =>
    api
      .get<StatusHistoryEntry[]>(`/documents/${id}/history`, { signal })
      .then((r) => r.data),
  attachments: (id: number, signal?: AbortSignal) =>
    api
      .get<DocumentAttachment[]>(`/documents/${id}/attachments`, { signal })
      .then((r) => r.data),
}
