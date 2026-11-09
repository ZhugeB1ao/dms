import { beforeAll, afterAll, afterEach, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from '../../../mocks/handlers.ts'
import { authHttp, session } from '../../../shared/api/http.ts'
import AuthProvider from './AuthProvider.tsx'
import { useAuth } from './useAuth.ts'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  resetMock()
  session.clear()
})
function Probe() {
  const auth = useAuth()
  return (
    <>
      <p>{auth.user?.displayName ?? 'Signed out'}</p>
      <button onClick={() => void auth.reloadUser().catch(() => {})}>
        Reload user
      </button>
      <button onClick={() => void auth.logout()}>Log out</button>
      <button
        onClick={() =>
          void auth.login({
            username: 'employee',
            password: 'Demo12345!',
          })
        }
      >
        Switch account
      </button>
    </>
  )
}
async function start() {
  const { data } = await authHttp.post('/auth/login', {
    username: 'admin',
    password: 'Demo12345!',
  })
  session.set(data.accessToken, data.refreshToken)
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
  await screen.findByText('admin')
}
it('reloads user details after editing the authenticated account', async () => {
  await start()
  server.use(
    http.get(
      'http://localhost/api/accounts/me',
      () =>
        HttpResponse.json({
          id: 1,
          username: 'admin',
          displayName: 'Updated admin',
          email: 'admin@demo.test',
          role: 'ADMIN',
          departmentId: null,
        }),
      { once: true },
    ),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Reload user' }))
  expect(await screen.findByText('Updated admin')).toBeVisible()
})
it('does not restore a stale user response after logout', async () => {
  await start()
  let started!: () => void
  const pending = new Promise<void>((resolve) => {
    started = resolve
  })
  server.use(
    http.get(
      'http://localhost/api/accounts/me',
      async () => {
        started()
        await delay(100)
        return HttpResponse.json({
          id: 1,
          username: 'admin',
          displayName: 'Stale admin',
          role: 'ADMIN',
        })
      },
      { once: true },
    ),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Reload user' }))
  await pending
  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(await screen.findByText('Signed out')).toBeVisible()
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(screen.queryByText('Stale admin')).toBeNull()
})

it('does not replace a new account with a delayed reload of the previous account', async () => {
  await start()
  let started!: () => void
  const pending = new Promise<void>((resolve) => {
    started = resolve
  })
  server.use(
    http.get(
      'http://localhost/api/accounts/me',
      async () => {
        started()
        await delay(400)
        return HttpResponse.json({
          id: 1,
          username: 'admin',
          email: 'admin@demo.test',
          displayName: 'Stale admin',
          role: 'ADMIN',
          departmentId: null,
        })
      },
      { once: true },
    ),
  )
  await userEvent.click(screen.getByRole('button', { name: 'Reload user' }))
  await pending
  await userEvent.click(screen.getByRole('button', { name: 'Switch account' }))
  expect(await screen.findByText('employee')).toBeVisible()
  await new Promise((resolve) => setTimeout(resolve, 450))
  expect(screen.queryByText('Stale admin')).toBeNull()
  expect(screen.getByText('employee')).toBeVisible()
})
