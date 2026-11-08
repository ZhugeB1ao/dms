import { http, HttpResponse, delay } from 'msw'
import type { Role } from '../shared/types/domain.ts'
import type {
  CategoryItem,
  CategoryTypeCode,
} from '../features/categories/api/categoryApi.ts'
import {
  getForbiddenParentIds,
  type DepartmentItem,
} from '../features/departments/api/departmentApi.ts'
import type { OrganizationItem } from '../features/organizations/api/organizationApi.ts'

const base = '/api'
const key = 'dms-mock-session-v1'

interface MockAccount {
  id: number
  username: string
  email: string
  role: Role
  departmentId: number | null
}

interface MockSessionState {
  userId: number
  refreshToken: string
  refreshUntil: number
  version: number
  accessUntil?: number
}

const accounts: MockAccount[] = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@demo.test',
    role: 'ADMIN',
    departmentId: 1,
  },
  {
    id: 2,
    username: 'manager',
    email: 'manager@demo.test',
    role: 'MANAGER',
    departmentId: 1,
  },
  {
    id: 3,
    username: 'employee',
    email: 'employee@demo.test',
    role: 'EMPLOYEE',
    departmentId: 1,
  },
  {
    id: 4,
    username: 'other',
    email: 'other@demo.test',
    role: 'EMPLOYEE',
    departmentId: 2,
  },
]

const initialCategories: CategoryItem[] = [
  {
    id: 1,
    type: 'DOC_TYPE',
    code: 'QD',
    name: 'Quyết định',
    symbol: 'QĐ',
    isActive: true,
  },
  {
    id: 2,
    type: 'DOC_TYPE',
    code: 'CV',
    name: 'Công văn',
    symbol: 'CV',
    isActive: true,
  },
  {
    id: 3,
    type: 'DOC_TYPE',
    code: 'TB',
    name: 'Thông báo',
    symbol: 'TB',
    isActive: true,
  },
  {
    id: 4,
    type: 'URGENCY',
    code: 'THUONG',
    name: 'Thường',
    symbol: null,
    isActive: true,
  },
  {
    id: 5,
    type: 'URGENCY',
    code: 'KHAN',
    name: 'Khẩn',
    symbol: 'K',
    isActive: true,
  },
  {
    id: 6,
    type: 'URGENCY',
    code: 'HOA_TOC',
    name: 'Hỏa tốc',
    symbol: 'HT',
    isActive: true,
  },
  {
    id: 7,
    type: 'CONFIDENTIALITY',
    code: 'THUONG',
    name: 'Thường',
    symbol: null,
    isActive: true,
  },
  {
    id: 8,
    type: 'CONFIDENTIALITY',
    code: 'MAT',
    name: 'Mật',
    symbol: 'M',
    isActive: true,
  },
  {
    id: 9,
    type: 'POSITION',
    code: 'GIAM_DOC',
    name: 'Giám đốc',
    symbol: 'GĐ',
    isActive: true,
  },
  {
    id: 10,
    type: 'POSITION',
    code: 'TRUONG_PHONG',
    name: 'Trưởng phòng',
    symbol: 'TP',
    isActive: true,
  },
  {
    id: 11,
    type: 'SEND_METHOD',
    code: 'BUU_DIEN',
    name: 'Bưu điện',
    symbol: null,
    isActive: true,
  },
  {
    id: 12,
    type: 'SEND_METHOD',
    code: 'TRUC_TIEP',
    name: 'Trực tiếp',
    symbol: null,
    isActive: true,
  },
]

const initialDepartments: DepartmentItem[] = [
  {
    id: 1,
    code: 'BGD',
    name: 'Ban Giám đốc',
    parentId: null,
    isActive: true,
  },
  {
    id: 2,
    code: 'P_HCTH',
    name: 'Phòng Hành chính - Tổng hợp',
    parentId: 1,
    isActive: true,
  },
  {
    id: 3,
    code: 'P_KHTC',
    name: 'Phòng Kế hoạch - Tài chính',
    parentId: 1,
    isActive: true,
  },
  {
    id: 4,
    code: 'TO_VT',
    name: 'Tổ Văn thư - Lưu trữ',
    parentId: 2,
    isActive: true,
  },
]

const activeUserDepartmentIds = new Set<number>([2, 3])

const initialOrganizations: OrganizationItem[] = [
  {
    id: 1,
    name: 'Bộ Giáo dục và Đào tạo',
    email: 'vanthu@moet.gov.vn',
    address: 'Số 35 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
    isActive: true,
  },
  {
    id: 2,
    name: 'Sở Khoa học và Công nghệ TP.HCM',
    email: 'skhcn@tphcm.gov.vn',
    address: 'Số 244 Điện Biên Phủ, Quận 3, TP.HCM',
    isActive: true,
  },
]

function load(): MockSessionState | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as MockSessionState) : null
  } catch {
    return null
  }
}

let state: MockSessionState | null = load()
let passwords: Record<number, string> = {}
let categories: CategoryItem[] = initialCategories.map((c) => ({ ...c }))
let departments: DepartmentItem[] = initialDepartments.map((d) => ({ ...d }))
let organizations: OrganizationItem[] = initialOrganizations.map((o) => ({
  ...o,
}))

function save() {
  if (state) sessionStorage.setItem(key, JSON.stringify(state))
  else sessionStorage.removeItem(key)
}

export function resetMock() {
  state = null
  passwords = {}
  categories = initialCategories.map((c) => ({ ...c }))
  departments = initialDepartments.map((d) => ({ ...d }))
  organizations = initialOrganizations.map((o) => ({ ...o }))
  save()
}

const fail = (
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
) =>
  HttpResponse.json(
    { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
    { status },
  )

function token() {
  return state ? `mock-${state.userId}-${state.version}` : ''
}

function userFor(request: Request): MockAccount | null {
  if (!state || (state.accessUntil ?? 0) <= Date.now()) return null
  const auth = request.headers.get('Authorization')
  const current = accounts.find((user) => user.id === state?.userId) ?? null
  if (!current) return null
  if (auth === `Bearer ${token()}`) return current
  return null
}

function issue() {
  if (!state)
    return { accessToken: '', refreshToken: '', tokenType: 'Bearer' as const }
  state.version++
  state.refreshToken = `rt-${state.userId}-${state.version}`
  state.accessUntil = Date.now() + 300000
  save()
  return {
    accessToken: token(),
    refreshToken: state.refreshToken,
    tokenType: 'Bearer' as const,
  }
}

const unauthorized = () =>
  fail(401, 'UNAUTHENTICATED', 'Your session has expired. Please log in again.')

const forbidden = () =>
  fail(403, 'FORBIDDEN', 'You do not have permission to perform this action.')

function requireRole(request: Request, role: Role): MockAccount | Response {
  const user = userFor(request)
  if (!user) return unauthorized()
  if (user.role !== role) return forbidden()
  return user
}

export const createMasterDataHandlers = (prefix: string) => [
  http.get(`${prefix}/categories/active`, ({ request }) => {
    const user = userFor(request)
    if (!user) return unauthorized()
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const list = categories.filter(
      (c) => c.isActive && (!type || c.type === type),
    )
    return HttpResponse.json(list)
  }),
  http.get(`${prefix}/categories`, ({ request }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const activeOnly = url.searchParams.get('activeOnly') === 'true'
    const list = categories.filter(
      (c) => (!type || c.type === type) && (!activeOnly || c.isActive),
    )
    return HttpResponse.json(list)
  }),
  http.post(`${prefix}/categories`, async ({ request }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    const body = (await request.json()) as {
      type?: CategoryTypeCode
      code?: string
      name?: string
      symbol?: string
    }
    const normalizedCode = (body.code || '').trim().toUpperCase()
    const type = body.type || 'DOC_TYPE'
    if (categories.some((c) => c.type === type && c.code === normalizedCode)) {
      return fail(409, 'CONFLICT', 'Mã danh mục đã tồn tại.', {
        code: 'Mã danh mục đã tồn tại trong nhóm này.',
      })
    }
    const nextId =
      categories.length > 0 ? Math.max(...categories.map((c) => c.id)) + 1 : 1
    const created: CategoryItem = {
      id: nextId,
      type,
      code: normalizedCode,
      name: (body.name || '').trim(),
      symbol: body.symbol ? body.symbol.trim() : null,
      isActive: true,
    }
    categories.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),
  http.put(`${prefix}/categories/:id`, async ({ request, params }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    const id = Number(params.id)
    const target = categories.find((c) => c.id === id)
    if (!target) return fail(404, 'NOT_FOUND', 'Category not found.')
    const body = (await request.json()) as {
      type?: CategoryTypeCode
      code?: string
      name?: string
      symbol?: string
    }
    const normalizedCode = (body.code || target.code).trim().toUpperCase()
    const nextType = body.type || target.type
    if (
      categories.some(
        (c) => c.id !== id && c.type === nextType && c.code === normalizedCode,
      )
    ) {
      return fail(409, 'CONFLICT', 'Mã danh mục đã tồn tại.', {
        code: 'Mã danh mục đã tồn tại trong nhóm này.',
      })
    }
    target.type = nextType
    target.code = normalizedCode
    target.name = (body.name ?? target.name).trim()
    target.symbol =
      body.symbol !== undefined ? body.symbol || null : target.symbol
    return HttpResponse.json(target)
  }),
  http.patch(`${prefix}/categories/:id/deactivate`, ({ request, params }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    const id = Number(params.id)
    const target = categories.find((c) => c.id === id)
    if (!target) return fail(404, 'NOT_FOUND', 'Category not found.')
    target.isActive = false
    return HttpResponse.json(target)
  }),
  http.get(`${prefix}/departments/active`, ({ request }) => {
    if (!userFor(request)) return unauthorized()
    return HttpResponse.json(departments.filter((d) => d.isActive))
  }),
  http.get(`${prefix}/departments/tree`, ({ request }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    return HttpResponse.json(departments)
  }),
  http.post(`${prefix}/departments`, async ({ request }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    const body = (await request.json()) as {
      code?: string
      name?: string
      parentId?: number | null
    }
    const code = (body.code || '').trim().toUpperCase()
    if (departments.some((d) => d.code === code)) {
      return fail(409, 'CONFLICT', 'Mã đơn vị đã tồn tại.', {
        code: 'Mã đơn vị đã tồn tại.',
      })
    }
    const parentId = body.parentId ? Number(body.parentId) : null
    const forbidden = getForbiddenParentIds(departments, null)
    if (
      parentId !== null &&
      (!departments.some((d) => d.id === parentId && d.isActive) ||
        forbidden.has(parentId))
    ) {
      return fail(
        409,
        'CONFLICT',
        'Đơn vị cha không hợp lệ hoặc vượt quá 3 cấp.',
        { parentId: 'Đơn vị cha không hợp lệ hoặc vượt quá 3 cấp.' },
      )
    }
    const nextId =
      departments.length > 0 ? Math.max(...departments.map((d) => d.id)) + 1 : 1
    const created: DepartmentItem = {
      id: nextId,
      code,
      name: (body.name || '').trim(),
      parentId,
      isActive: true,
    }
    departments.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),
  http.put(`${prefix}/departments/:id`, async ({ request, params }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    const id = Number(params.id)
    const target = departments.find((d) => d.id === id)
    if (!target) return fail(404, 'NOT_FOUND', 'Department not found.')
    const body = (await request.json()) as {
      code?: string
      name?: string
      parentId?: number | null
    }
    const code = (body.code || target.code).trim().toUpperCase()
    if (departments.some((d) => d.id !== id && d.code === code)) {
      return fail(409, 'CONFLICT', 'Mã đơn vị đã tồn tại.', {
        code: 'Mã đơn vị đã tồn tại.',
      })
    }
    const parentId =
      body.parentId !== undefined
        ? body.parentId
          ? Number(body.parentId)
          : null
        : target.parentId
    const forbidden = getForbiddenParentIds(departments, id)
    if (parentId !== null && forbidden.has(parentId)) {
      return fail(
        409,
        'CONFLICT',
        'Không thể chọn chính nó hoặc đơn vị con làm đơn vị cha (hoặc vượt quá 3 cấp).',
        {
          parentId:
            'Không thể chọn chính nó hoặc đơn vị con làm đơn vị cha (hoặc vượt quá 3 cấp).',
        },
      )
    }
    target.code = code
    target.name = (body.name ?? target.name).trim()
    target.parentId = parentId
    return HttpResponse.json(target)
  }),
  http.patch(`${prefix}/departments/:id/deactivate`, ({ request, params }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    const id = Number(params.id)
    const target = departments.find((d) => d.id === id)
    if (!target) return fail(404, 'NOT_FOUND', 'Department not found.')
    if (activeUserDepartmentIds.has(id)) {
      return fail(
        409,
        'CONFLICT',
        'Không thể ngưng dùng đơn vị vì vẫn còn tài khoản đang hoạt động.',
      )
    }
    if (departments.some((d) => d.parentId === id && d.isActive)) {
      return fail(
        409,
        'CONFLICT',
        'Không thể ngưng dùng đơn vị vì vẫn còn đơn vị trực thuộc đang hoạt động.',
      )
    }
    target.isActive = false
    return HttpResponse.json(target)
  }),
  http.get(`${prefix}/organizations/active`, ({ request }) => {
    if (!userFor(request)) return unauthorized()
    return HttpResponse.json(organizations.filter((o) => o.isActive))
  }),
  http.get(`${prefix}/organizations`, ({ request }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    return HttpResponse.json(organizations)
  }),
  http.post(`${prefix}/organizations`, async ({ request }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    const body = (await request.json()) as {
      name?: string
      email?: string
      address?: string
    }
    const name = (body.name || '').trim()
    if (
      organizations.some((o) => o.name.toLowerCase() === name.toLowerCase())
    ) {
      return fail(409, 'CONFLICT', 'Tên cơ quan ngoài đã tồn tại.', {
        name: 'Tên cơ quan ngoài đã tồn tại.',
      })
    }
    const nextId =
      organizations.length > 0
        ? Math.max(...organizations.map((o) => o.id)) + 1
        : 1
    const created: OrganizationItem = {
      id: nextId,
      name,
      email: body.email ? String(body.email).trim() : null,
      address: body.address ? String(body.address).trim() : null,
      isActive: true,
    }
    organizations.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),
  http.put(`${prefix}/organizations/:id`, async ({ request, params }) => {
    const check = requireRole(request, 'ADMIN')
    if (check instanceof Response) return check
    const id = Number(params.id)
    const target = organizations.find((o) => o.id === id)
    if (!target) return fail(404, 'NOT_FOUND', 'Organization not found.')
    const body = (await request.json()) as {
      name?: string
      email?: string
      address?: string
    }
    const name = (body.name ?? target.name).trim()
    if (
      organizations.some(
        (o) => o.id !== id && o.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      return fail(409, 'CONFLICT', 'Tên cơ quan ngoài đã tồn tại.', {
        name: 'Tên cơ quan ngoài đã tồn tại.',
      })
    }
    target.name = name
    target.email =
      body.email !== undefined
        ? String(body.email).trim() || null
        : target.email
    target.address =
      body.address !== undefined
        ? String(body.address).trim() || null
        : target.address
    return HttpResponse.json(target)
  }),
  http.patch(
    `${prefix}/organizations/:id/deactivate`,
    ({ request, params }) => {
      const check = requireRole(request, 'ADMIN')
      if (check instanceof Response) return check
      const id = Number(params.id)
      const target = organizations.find((o) => o.id === id)
      if (!target) return fail(404, 'NOT_FOUND', 'Organization not found.')
      target.isActive = false
      return HttpResponse.json(target)
    },
  ),
]

export const coreHandlers = [
  http.post(`${base}/auth/login`, async ({ request }) => {
    await delay(50)
    const { username, password } = (await request.json()) as {
      username?: string
      password?: string
    }
    const user = accounts.find((u) => u.username === username?.trim())
    if (!user || password !== (passwords[user.id] || 'Demo12345!'))
      return fail(401, 'INVALID_CREDENTIALS', 'Wrong Username or Password!')
    state = {
      userId: user.id,
      refreshToken: '',
      refreshUntil: Date.now() + 28800000,
      version: 0,
    }
    return HttpResponse.json(issue())
  }),
  http.get(`${base}/auth/me`, ({ request }) => {
    const user = userFor(request)
    return user ? HttpResponse.json(user) : unauthorized()
  }),
  http.get(`${base}/accounts/me`, ({ request }) => {
    const user = userFor(request)
    return user ? HttpResponse.json(user) : unauthorized()
  }),
  http.post(`${base}/auth/refresh`, async ({ request }) => {
    await delay(30)
    const body = (await request.json().catch(() => ({}))) as {
      refreshToken?: string
    }
    if (!body.refreshToken)
      return fail(400, 'BAD_REQUEST', 'Refresh token must not be blank!')
    if (
      !state ||
      state.refreshUntil <= Date.now() ||
      body.refreshToken !== state.refreshToken
    )
      return unauthorized()
    return HttpResponse.json(issue())
  }),
  http.post(`${base}/auth/logout`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      refreshToken?: string
    }
    if (state && body.refreshToken === state.refreshToken) {
      state = null
      save()
    }
    return HttpResponse.json({ message: 'Đăng xuất thành công!' })
  }),
  http.post(`${base}/auth/forgot-password`, async ({ request }) => {
    const { email } = (await request.json()) as { email?: unknown }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return fail(422, 'VALIDATION', 'Enter a valid email address.')
    return HttpResponse.json(
      {
        message:
          'If an account exists for this email, your recovery request will be processed.',
      },
      { status: 202 },
    )
  }),
  ...['/auth/change-password', '/accounts/me/change-password'].map((path) =>
    http.post(`${base}${path}`, async ({ request }) => {
      const user = userFor(request)
      if (!user) return unauthorized()
      const { currentPassword, newPassword } = (await request.json()) as {
        currentPassword?: unknown
        newPassword?: unknown
      }
      if (currentPassword !== (passwords[user.id] || 'Demo12345!'))
        return fail(
          422,
          'WRONG_PASSWORD',
          'Your current password is incorrect.',
          {
            currentPassword: 'Your current password is incorrect.',
          },
        )
      if (
        typeof newPassword !== 'string' ||
        newPassword.length < 8 ||
        newPassword.length > 128
      )
        return fail(
          422,
          'VALIDATION',
          'Your new password must contain 8–128 characters.',
        )
      passwords[user.id] = newPassword
      state = null
      save()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
  http.get(`${base}/demo/documents/:id`, ({ request, params }) => {
    const user = userFor(request)
    if (!user) return unauthorized()
    const documents: Record<
      string,
      { id: string; departmentId: number; assigneeIds: number[] }
    > = {
      a: { id: 'a', departmentId: 1, assigneeIds: [3] },
      b: { id: 'b', departmentId: 2, assigneeIds: [4] },
    }
    const docId = String(params.id)
    const document = documents[docId]
    if (!document) return fail(404, 'NOT_FOUND', 'Document not found.')
    const allowed =
      user.role === 'MANAGER'
        ? user.departmentId === document.departmentId
        : user.role === 'EMPLOYEE' && document.assigneeIds.includes(user.id)
    return allowed
      ? HttpResponse.json(document)
      : fail(
          403,
          'FORBIDDEN',
          'You do not have permission to view this document.',
        )
  }),
  http.post(`${base}/demo/session`, async ({ request }) => {
    const { scenario } = (await request.json()) as { scenario?: string }
    if (!state) return unauthorized()
    if (scenario === 'access-expired') state.accessUntil = 0
    else if (scenario === 'refresh-expired') {
      state.accessUntil = 0
      state.refreshUntil = 0
    } else return fail(422, 'VALIDATION', 'Invalid demo scenario.')
    save()
    return new HttpResponse(null, { status: 204 })
  }),
]

export const handlers = [...coreHandlers, ...createMasterDataHandlers(base)]

export const browserHandlers = handlers
