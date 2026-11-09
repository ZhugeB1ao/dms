import { beforeAll, afterAll, afterEach, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from './handlers.ts'
import { api, authHttp, session } from '../shared/api/http.ts'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  resetMock()
  session.clear()
})
async function login(username = 'admin', password = 'Demo12345!') {
  const { data } = await authHttp.post('/auth/login', { username, password })
  session.set(data.accessToken, data.refreshToken)
}
const input = {
  username: 'newuser',
  email: 'new@demo.test',
  departmentId: 2,
  position: 'Clerk',
  role: 'EMPLOYEE',
  tempPassword: 'Temp12345!',
}

it('pages from zero, filters by department/role/active and reports totals', async () => {
  await login()
  const first = await api.get('/accounts', { params: { size: 10 } })
  expect(first.data).toMatchObject({
    page: 0,
    size: 10,
    totalElements: 28,
    totalPages: 3,
  })
  expect(first.data.content).toHaveLength(10)
  const filtered = await api.get('/accounts', {
    params: { departmentId: 2, role: 'EMPLOYEE', active: true },
  })
  expect(filtered.data.totalElements).toBe(5)
  expect(
    (await api.get('/accounts', { params: { page: 99 } })).data.content,
  ).toEqual([])
  await expect(
    api.get('/accounts', { params: { size: 101 } }),
  ).rejects.toMatchObject({ response: { status: 400 } })
})

it('only lets ADMIN manage accounts, while /accounts/me works for everyone', async () => {
  await login('employee')
  await expect(api.get('/accounts')).rejects.toMatchObject({
    response: { status: 403 },
  })
  expect((await api.get('/accounts/me')).data).toMatchObject({
    username: 'employee',
    role: 'EMPLOYEE',
  })
})

it('creates an account with a temporary password, then edits, disables and reactivates it', async () => {
  await login()
  const created = await api.post('/accounts', input)
  expect(created.status).toBe(201)
  expect(created.data).toMatchObject({
    username: 'newuser',
    active: true,
    mustChangePassword: true,
  })
  expect(created.data).not.toHaveProperty('tempPassword')
  const id = created.data.id
  await api.put(`/accounts/${id}`, {
    email: 'changed@demo.test',
    departmentId: 3,
    position: null,
    role: 'MANAGER',
  })
  await api.patch(`/accounts/${id}/status`, { active: false })
  await expect(login('newuser', 'Temp12345!')).rejects.toMatchObject({
    response: { status: 401 },
  })
  await login()
  await api.patch(`/accounts/${id}/status`, { active: true })
  await login('newuser', 'Temp12345!')
  expect((await api.get('/accounts/me')).data).toMatchObject({
    email: 'changed@demo.test',
    role: 'MANAGER',
    position: null,
  })
})

it('rejects duplicates, invalid fields and self-deactivation', async () => {
  await login()
  await expect(
    api.post('/accounts', { ...input, email: 'EMPLOYEE@demo.test' }),
  ).rejects.toMatchObject({ response: { status: 409 } })
  await expect(
    api.post('/accounts', { ...input, username: 'admin' }),
  ).rejects.toMatchObject({ response: { status: 409 } })
  await expect(
    api.post('/accounts', {
      ...input,
      username: 'has space',
      email: 'bad',
      role: 'ROOT',
      tempPassword: 'short',
    }),
  ).rejects.toMatchObject({
    response: {
      status: 400,
      data: {
        fieldErrors: {
          username: expect.any(String),
          email: expect.any(String),
          role: expect.any(String),
          tempPassword: expect.any(String),
        },
      },
    },
  })
  await expect(
    api.patch('/accounts/1/status', { active: false }),
  ).rejects.toMatchObject({ response: { status: 400 } })
  await expect(
    api.patch('/accounts/999/status', { active: false }),
  ).rejects.toMatchObject({ response: { status: 404 } })
})

it('reset-password sets a temporary password, forces a change and ends the old session', async () => {
  await login()
  await api.post('/accounts/3/reset-password', { tempPassword: 'Reset12345!' })
  await expect(login('employee')).rejects.toMatchObject({
    response: { status: 401 },
  })
  await login('employee', 'Reset12345!')
  expect((await api.get('/accounts/me')).data.mustChangePassword).toBe(true)
  await api.post('/accounts/me/change-password', {
    currentPassword: 'Reset12345!',
    newPassword: 'Next12345!',
  })
  await login('employee', 'Next12345!')
  expect((await api.get('/accounts/me')).data.mustChangePassword).toBe(false)
})

it('resets created accounts and password changes between demos', async () => {
  await login()
  await api.post('/accounts', input)
  resetMock()
  await login()
  expect((await api.get('/accounts')).data.totalElements).toBe(28)
})
