import { beforeAll, afterAll, afterEach, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { handlers, resetMock } from '../mocks/handlers.ts'
import { session, authHttp } from '../shared/api/http.ts'
import AuthProvider from '../features/auth/context/AuthProvider.tsx'
import AppRouter from './router/AppRouter.tsx'
import { canAccess, safeDestination } from './router/access.ts'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  resetMock()
  session.clear()
})
const renderPage = (path = '/login') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </MemoryRouter>,
  )

it('keeps the signup demo separate and links back to mock login', async () => {
  const user = userEvent.setup()
  renderPage('/')
  await user.click(screen.getByRole('button', { name: 'Sign up' }))
  const dialog = await screen.findByRole('dialog', {
    name: 'Create your account',
  })
  expect(within(dialog).getByText(/No account connection yet/)).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Log in' }))
  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible()
})

it('ignores a slow login after leaving the login page', async () => {
  server.use(
    http.post('http://localhost/api/v1/auth/login', async () => {
      await delay(150)
      return HttpResponse.json({
        accessToken: 'late',
        user: { id: 'employee', roles: ['EMPLOYEE'] },
      })
    }),
  )
  const user = userEvent.setup()
  renderPage()
  await user.type(
    screen.getByRole('textbox', { name: 'Email' }),
    'employee@demo.test',
  )
  const loginForm = within(screen.getByRole('region', { name: 'Log in' }))
  await user.type(loginForm.getByLabelText('Password'), 'Demo12345!')
  await user.click(loginForm.getByRole('button', { name: 'Log in' }))
  await user.click(screen.getByRole('link', { name: 'Forgot password?' }))
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(session.token).toBeNull()
})
it('logs Employee in with scoped menu and logs out', async () => {
  const user = userEvent.setup()
  renderPage('/admin/users')
  await screen.findByRole('heading', { name: 'Log in' })
  expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull()
  expect(screen.queryByRole('button', { name: /sidebar/i })).toBeNull()
  await user.type(
    screen.getByRole('textbox', { name: 'Email' }),
    'employee@demo.test',
  )
  const loginForm = within(screen.getByRole('region', { name: 'Log in' }))
  await user.type(loginForm.getByLabelText('Password'), 'Demo12345!')
  await user.click(loginForm.getByRole('button', { name: 'Log in' }))
  await screen.findByRole('heading', { name: 'Overview' })
  expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeVisible()
  const nav = screen.getByRole('navigation', { name: 'Navigation' })
  expect(
    within(nav).getByRole('link', { name: 'Incoming correspondence' }),
  ).toBeVisible()
  expect(
    within(nav).getByRole('link', { name: 'OCR & Documents' }),
  ).toBeVisible()
  expect(within(nav).getByRole('link', { name: 'AI Assistant' })).toBeVisible()
  expect(within(nav).queryByRole('link', { name: 'Users' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Log out' }))
  await screen.findByRole('heading', { name: 'Log in' })
  expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull()
  expect(screen.queryByRole('button', { name: /sidebar/i })).toBeNull()
})
it('shows 404 for unknown routes', async () => {
  renderPage('/not-found')
  expect(await screen.findByRole('heading', { name: /404/ })).toBeVisible()
})
it('denies unknown roles and external return URLs', () => {
  expect(canAccess({ roles: ['UNKNOWN'] }, ['ADMIN'])).toBe(false)
  expect(safeDestination('//evil.test', { roles: ['ADMIN'] })).toBe(
    '/dashboard',
  )
  expect(safeDestination('/approvals', { roles: ['ADMIN'] })).toBe('/dashboard')
  expect(safeDestination('/records?q=test', { roles: ['EMPLOYEE'] })).toBe(
    '/records?q=test',
  )
})
it.each([
  ['admin@demo.test', '/approvals', /403/],
  ['employee@demo.test', '/admin/users', /403/],
  ['employee@demo.test', '/admin/departments', /403/],
  ['manager@demo.test', '/admin/organizations', /403/],
  ['admin@demo.test', '/admin/departments', 'Departments'],
  ['admin@demo.test', '/admin/organizations', 'Organizations'],
  ['manager@demo.test', '/approvals', 'Pending approvals'],
])('guards %s visiting %s', async (email, path, title) => {
  await authHttp.post('/auth/login', { email, password: 'Demo12345!' })
  renderPage(path)
  expect(await screen.findByRole('heading', { name: title })).toBeVisible()
})
