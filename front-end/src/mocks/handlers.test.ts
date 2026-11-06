import { beforeAll, afterAll, afterEach, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from './handlers.ts'
import { api, authHttp, session } from '../shared/api/http.ts'
import type { CategoryItem } from '../features/categories/api/categoryApi.ts'
import {
  buildDepartmentRows,
  getForbiddenParentIds,
  type DepartmentItem,
} from '../features/departments/api/departmentApi.ts'
import type { OrganizationItem } from '../features/organizations/api/organizationApi.ts'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  resetMock()
  session.clear()
  server.resetHandlers()
})
async function login(email: string) {
  const { data } = await authHttp.post('/auth/login', {
    email,
    password: 'Demo12345!',
  })
  session.set(data.accessToken)
  return data
}
it.each([
  ['admin@demo.test', 'ADMIN'],
  ['manager@demo.test', 'MANAGER'],
  ['employee@demo.test', 'EMPLOYEE'],
])('returns the correct role for %s', async (email, role) => {
  const result = await login(email)
  expect(result.user.roles).toEqual([role])
  expect(result.expiresIn).toBe(300)
  expect((await api.get('/auth/me')).data.id).toBe(result.user.id)
})
it('enforces document scope for employee and manager', async () => {
  for (const email of ['employee@demo.test', 'manager@demo.test']) {
    await login(email)
    expect((await api.get('/demo/documents/a')).status).toBe(200)
    await expect(api.get('/demo/documents/b')).rejects.toMatchObject({
      response: { status: 403 },
    })
  }
})
it('refreshes an expired access token and logs out for expired refresh', async () => {
  await login('employee@demo.test')
  await authHttp.post('/demo/session', { scenario: 'access-expired' })
  expect((await api.get('/demo/documents/a')).status).toBe(200)
  await authHttp.post('/demo/session', { scenario: 'refresh-expired' })
  await expect(api.get('/demo/documents/a')).rejects.toBeDefined()
  expect(session.token).toBeNull()
})
it('changes password, revokes session, rejects old password and accepts new password', async () => {
  await login('employee@demo.test')
  await expect(
    api.post('/auth/change-password', {
      currentPassword: 'wrong',
      newPassword: 'Next12345!',
    }),
  ).rejects.toMatchObject({ response: { status: 422 } })
  expect(
    (
      await api.post('/auth/change-password', {
        currentPassword: 'Demo12345!',
        newPassword: 'Next12345!',
      })
    ).status,
  ).toBe(204)
  await expect(login('employee@demo.test')).rejects.toMatchObject({
    response: { status: 401 },
  })
  expect(
    (
      await authHttp.post('/auth/login', {
        email: 'employee@demo.test',
        password: 'Next12345!',
      })
    ).status,
  ).toBe(200)
})
it('responds neutrally to known and unknown recovery emails', async () => {
  const known = await authHttp.post('/auth/forgot-password', {
    email: 'employee@demo.test',
  })
  const unknown = await authHttp.post('/auth/forgot-password', {
    email: 'nobody@example.com',
  })
  expect(known.status).toBe(202)
  expect(unknown.data).toEqual(known.data)
})

it('cho phép ADMIN quản lý danh mục và chặn MANAGER / EMPLOYEE với 403 Forbidden', async () => {
  await login('manager@demo.test')
  await expect(api.get('/categories')).rejects.toMatchObject({
    response: { status: 403 },
  })

  await login('employee@demo.test')
  await expect(api.get('/categories')).rejects.toMatchObject({
    response: { status: 403 },
  })

  await login('admin@demo.test')
  const res = await api.get('/categories')
  expect(res.status).toBe(200)
  expect(res.data.length).toBe(12)
})

it('xử lý thêm mới, trùng mã (409 Conflict), cập nhật và ngưng dùng danh mục', async () => {
  await login('admin@demo.test')

  const created = await api.post('/categories', {
    type: 'DOC_TYPE',
    code: 'tt',
    name: 'Thông tư',
    symbol: 'TT',
  })
  expect(created.status).toBe(201)
  expect(created.data.code).toBe('TT')
  expect(created.data.isActive).toBe(true)

  await expect(
    api.post('/categories', {
      type: 'DOC_TYPE',
      code: 'TT',
      name: 'Thông tư trùng mã',
    }),
  ).rejects.toMatchObject({
    response: {
      status: 409,
      data: {
        code: 'CONFLICT',
        fieldErrors: { code: expect.any(String) },
      },
    },
  })

  const updated = await api.put(`/categories/${created.data.id}`, {
    type: 'DOC_TYPE',
    code: 'TT',
    name: 'Thông tư liên tịch',
    symbol: 'TTLT',
  })
  expect(updated.data.name).toBe('Thông tư liên tịch')
  expect(updated.data.symbol).toBe('TTLT')

  const deactivated = await api.patch(
    `/categories/${created.data.id}/deactivate`,
  )
  expect(deactivated.data.isActive).toBe(false)

  const activeRes = await api.get<CategoryItem[]>('/categories/active', {
    params: { type: 'DOC_TYPE' },
  })
  expect(activeRes.data.some((c) => c.id === created.data.id)).toBe(false)
})

it('phân quyền API đơn vị & cơ quan ngoài: chặn MANAGER / EMPLOYEE (403) nhưng mở /active (200)', async () => {
  for (const email of ['manager@demo.test', 'employee@demo.test']) {
    await login(email)
    await expect(api.get('/departments/tree')).rejects.toMatchObject({
      response: { status: 403 },
    })
    await expect(
      api.post('/departments', { code: 'X', name: 'X' }),
    ).rejects.toMatchObject({
      response: { status: 403 },
    })
    await expect(api.get('/organizations')).rejects.toMatchObject({
      response: { status: 403 },
    })
    expect((await api.get('/departments/active')).status).toBe(200)
    expect((await api.get('/organizations/active')).status).toBe(200)
  }
})

it('tạo cây đơn vị 3 cấp, chặn vòng lặp cha-con và chặn vượt quá 3 cấp', async () => {
  await login('admin@demo.test')

  const treeRes = await api.get<DepartmentItem[]>('/departments/tree')
  const rows = buildDepartmentRows(treeRes.data)
  expect(rows.map((r) => [r.code, r.depth])).toEqual([
    ['BGD', 1],
    ['P_HCTH', 2],
    ['TO_VT', 3],
    ['P_KHTC', 2],
  ])

  const forbiddenForRoot = getForbiddenParentIds(treeRes.data, 1)
  expect(forbiddenForRoot.has(1)).toBe(true)
  expect(forbiddenForRoot.has(2)).toBe(true)
  expect(forbiddenForRoot.has(4)).toBe(true)

  await expect(
    api.put('/departments/1', {
      code: 'BGD',
      name: 'Ban Giám đốc',
      parentId: 4,
    }),
  ).rejects.toMatchObject({
    response: {
      status: 409,
      data: { fieldErrors: { parentId: expect.any(String) } },
    },
  })

  await expect(
    api.post('/departments', {
      code: 'NHOM_4',
      name: 'Nhóm Cấp 4',
      parentId: 4,
    }),
  ).rejects.toMatchObject({
    response: {
      status: 409,
      data: { fieldErrors: { parentId: expect.any(String) } },
    },
  })
})

it('chặn ngưng dùng đơn vị còn tài khoản hoạt động hoặc còn đơn vị con hoạt động', async () => {
  await login('admin@demo.test')

  await expect(api.patch('/departments/2/deactivate')).rejects.toMatchObject({
    response: { status: 409 },
  })

  await expect(api.patch('/departments/1/deactivate')).rejects.toMatchObject({
    response: { status: 409 },
  })

  const deactivated = await api.patch<DepartmentItem>(
    '/departments/4/deactivate',
  )
  expect(deactivated.data.isActive).toBe(false)
})

it('quản lý cơ quan ngoài: thêm, sửa, chặn trùng tên (409) và ngưng dùng', async () => {
  await login('admin@demo.test')

  const created = await api.post<OrganizationItem>('/organizations', {
    name: 'Ủy ban Nhân dân TP.HCM',
    email: 'ubnd@tphcm.gov.vn',
    address: '86 Lê Thánh Tôn, Quận 1',
  })
  expect(created.status).toBe(201)
  expect(created.data.isActive).toBe(true)

  await expect(
    api.post('/organizations', { name: 'Ủy ban Nhân dân TP.HCM' }),
  ).rejects.toMatchObject({
    response: { status: 409 },
  })

  const deactivated = await api.patch<OrganizationItem>(
    `/organizations/${created.data.id}/deactivate`,
  )
  expect(deactivated.data.isActive).toBe(false)
})
