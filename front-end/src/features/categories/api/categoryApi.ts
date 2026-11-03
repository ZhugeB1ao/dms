import axios from 'axios'
import { session } from '../../../shared/api/http.ts'

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

// Gọi qua Vite proxy (/category-api -> http://localhost:8080/api) để tránh lỗi CORS khi đổi port
const rawCategoryBaseUrl = import.meta.env.VITE_CATEGORY_API_URL as
  string | undefined
const categoryBaseUrl =
  import.meta.env.DEV &&
  (!rawCategoryBaseUrl || rawCategoryBaseUrl === 'http://localhost:8080/api')
    ? '/category-api'
    : rawCategoryBaseUrl || 'http://localhost:8080/api'

const categoryHttp = axios.create({
  baseURL: categoryBaseUrl,
  timeout: 10000,
})

// Đính kèm token ADMIN để Backend xác thực quyền theo MockJwtAuthenticationFilter
categoryHttp.interceptors.request.use((config) => {
  if (session.token?.startsWith('mock-admin')) {
    config.headers.Authorization = 'Bearer ADMIN'
  } else if (session.token?.startsWith('mock-manager')) {
    config.headers.Authorization = 'Bearer MANAGER'
  } else if (session.token?.startsWith('mock-employee')) {
    config.headers.Authorization = 'Bearer EMPLOYEE'
  }
  return config
})

export const CATEGORY_TYPES: Record<CategoryTypeCode, string> = {
  DOC_TYPE: 'Loại văn bản',
  URGENCY: 'Độ khẩn',
  CONFIDENTIALITY: 'Độ mật',
  POSITION: 'Chức vụ',
  SEND_METHOD: 'Phương thức gửi',
  FIELD: 'Lĩnh vực',
}

export const categoryApi = {
  // 1. GET /api/categories?type=...&activeOnly=...
  list: (params?: CategoryFilterParams, signal?: AbortSignal) =>
    categoryHttp
      .get<CategoryItem[]>('/categories', { params, signal })
      .then((r) => r.data),

  // 2. GET /api/categories/active?type=...
  listActive: (type?: string, signal?: AbortSignal) =>
    categoryHttp
      .get<CategoryItem[]>('/categories/active', {
        params: type ? { type } : undefined,
        signal,
      })
      .then((r) => r.data),

  // 3. POST /api/categories
  create: (values: Record<string, unknown>, signal?: AbortSignal) =>
    categoryHttp
      .post<CategoryItem>('/categories', values, { signal })
      .then((r) => r.data),

  // 4. PUT /api/categories/:id
  update: (id: number, values: Record<string, unknown>, signal?: AbortSignal) =>
    categoryHttp
      .put<CategoryItem>(`/categories/${id}`, values, { signal })
      .then((r) => r.data),

  // 5. PATCH /api/categories/:id/deactivate
  deactivate: (id: number, signal?: AbortSignal) =>
    categoryHttp
      .patch<CategoryItem>(`/categories/${id}/deactivate`, null, { signal })
      .then((r) => r.data),
}
