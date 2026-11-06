import { categoryHttp } from '../../../shared/api/http.ts'

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
  DOC_TYPE: 'Loại văn bản',
  URGENCY: 'Độ khẩn',
  CONFIDENTIALITY: 'Độ mật',
  POSITION: 'Chức vụ',
  SEND_METHOD: 'Phương thức gửi',
  FIELD: 'Lĩnh vực',
}

export const categoryApi = {
  list: (params?: CategoryFilterParams, signal?: AbortSignal) =>
    categoryHttp
      .get<CategoryItem[]>('/categories', { params, signal })
      .then((r) => r.data),

  listActive: (type?: string, signal?: AbortSignal) =>
    categoryHttp
      .get<CategoryItem[]>('/categories/active', {
        params: type ? { type } : undefined,
        signal,
      })
      .then((r) => r.data),

  create: (values: Record<string, unknown>, signal?: AbortSignal) =>
    categoryHttp
      .post<CategoryItem>('/categories', values, { signal })
      .then((r) => r.data),

  update: (id: number, values: Record<string, unknown>, signal?: AbortSignal) =>
    categoryHttp
      .put<CategoryItem>(`/categories/${id}`, values, { signal })
      .then((r) => r.data),

  deactivate: (id: number, signal?: AbortSignal) =>
    categoryHttp
      .patch<CategoryItem>(`/categories/${id}/deactivate`, null, { signal })
      .then((r) => r.data),
}
