import { backendHttp } from '../../../shared/api/http.ts'

export type CategoryTypeCode =
  | 'DOC_TYPE'
  | 'URGENCY'
  | 'CONFIDENTIALITY'
  | 'POSITION'
  | 'SEND_METHOD'
  | 'FIELD'

export interface CategoryItem {
  id: number
  type: CategoryTypeCode
  code: string
  name: string
  symbol?: string | null
  isActive: boolean
}

export interface CategoryFilterParams {
  type?: string
  activeOnly?: boolean
}

export const CATEGORY_TYPES: Record<CategoryTypeCode, string> = {
  DOC_TYPE: 'Document type',
  URGENCY: 'Urgency',
  CONFIDENTIALITY: 'Confidentiality',
  POSITION: 'Position',
  SEND_METHOD: 'Delivery method',
  FIELD: 'Field',
}

export const categoryApi = {
  list: (params?: CategoryFilterParams, signal?: AbortSignal) =>
    backendHttp
      .get<CategoryItem[]>('/categories', { params, signal })
      .then((r) => r.data),

  listActive: (type?: string, signal?: AbortSignal) =>
    backendHttp
      .get<CategoryItem[]>('/categories/active', {
        params: type ? { type } : undefined,
        signal,
      })
      .then((r) => r.data),

  create: (values: Record<string, unknown>, signal?: AbortSignal) =>
    backendHttp
      .post<CategoryItem>('/categories', values, { signal })
      .then((r) => r.data),

  update: (id: number, values: Record<string, unknown>, signal?: AbortSignal) =>
    backendHttp
      .put<CategoryItem>(`/categories/${id}`, values, { signal })
      .then((r) => r.data),

  deactivate: (id: number, signal?: AbortSignal) =>
    backendHttp
      .patch<CategoryItem>(`/categories/${id}/deactivate`, null, { signal })
      .then((r) => r.data),
}
