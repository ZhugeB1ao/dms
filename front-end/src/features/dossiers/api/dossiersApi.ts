import { api } from '@/shared/api/http.ts'
import type {
  Dossier,
  DossierDocument,
  DossierInput,
  DossierPage,
  DossierQuery,
} from '@/features/dossiers/types.ts'

export const dossiersApi = {
  list: (params: DossierQuery, signal?: AbortSignal) =>
    api.get<DossierPage>('/dossiers', { params, signal }).then((r) => r.data),
  get: (id: number, signal?: AbortSignal) =>
    api.get<Dossier>(`/dossiers/${id}`, { signal }).then((r) => r.data),
  create: (input: DossierInput, signal?: AbortSignal) =>
    api.post<Dossier>('/dossiers', input, { signal }).then((r) => r.data),
  update: (id: number, input: DossierInput, signal?: AbortSignal) =>
    api.put<Dossier>(`/dossiers/${id}`, input, { signal }).then((r) => r.data),
  close: (id: number, signal?: AbortSignal) =>
    api
      .post<Dossier>(`/dossiers/${id}/close`, undefined, { signal })
      .then((r) => r.data),
  listDocuments: (id: number, signal?: AbortSignal) =>
    api
      .get<DossierDocument[]>(`/dossiers/${id}/documents`, { signal })
      .then((r) => r.data),
  listAvailableDocuments: (id: number, signal?: AbortSignal) =>
    api
      .get<DossierDocument[]>(`/dossiers/${id}/available-documents`, { signal })
      .then((r) => r.data),
  attachDocument: async (
    id: number,
    documentId: number,
    signal?: AbortSignal,
  ): Promise<void> => {
    await api.post(`/dossiers/${id}/documents`, { documentId }, { signal })
  },
  detachDocument: async (
    id: number,
    documentId: number,
    signal?: AbortSignal,
  ): Promise<void> => {
    await api.delete(`/dossiers/${id}/documents/${documentId}`, { signal })
  },
}
