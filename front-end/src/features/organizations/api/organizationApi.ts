import { categoryHttp } from '../../../shared/api/http.ts'

export interface OrganizationItem {
  id: number
  name: string
  address?: string | null
  email?: string | null
  isActive: boolean
}

export const organizationApi = {
  list: (signal?: AbortSignal) =>
    categoryHttp
      .get<OrganizationItem[]>('/organizations', { signal })
      .then((r) => r.data),

  listActive: (signal?: AbortSignal) =>
    categoryHttp
      .get<OrganizationItem[]>('/organizations/active', { signal })
      .then((r) => r.data),

  create: (values: Record<string, unknown>, signal?: AbortSignal) =>
    categoryHttp
      .post<OrganizationItem>('/organizations', values, { signal })
      .then((r) => r.data),

  update: (id: number, values: Record<string, unknown>, signal?: AbortSignal) =>
    categoryHttp
      .put<OrganizationItem>(`/organizations/${id}`, values, { signal })
      .then((r) => r.data),

  deactivate: (id: number, signal?: AbortSignal) =>
    categoryHttp
      .patch<OrganizationItem>(`/organizations/${id}/deactivate`, null, {
        signal,
      })
      .then((r) => r.data),
}
