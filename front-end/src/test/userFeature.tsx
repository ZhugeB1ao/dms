import { beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from '../mocks/handlers.ts'
import { authHttp, session } from '../shared/api/http.ts'
import AuthProvider from '../features/auth/context/AuthProvider.tsx'
import AppRouter from '../app/router/AppRouter.tsx'

export const featureServer = setupServer(...handlers)
beforeAll(() => featureServer.listen({ onUnhandledFrame: 'error' }))
afterAll(() => featureServer.close())
afterEach(() => {
  featureServer.resetHandlers()
  resetMock()
  session.clear()
})
export async function renderAccountRoute(
  path = '/admin/users',
  username = 'admin',
) {
  const { data } = await authHttp.post('/auth/login', {
    username,
    password: 'Demo12345!',
  })
  session.set(data.accessToken, data.refreshToken)
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </MemoryRouter>,
  )
  if (path === '/admin/users' && username === 'admin')
    await screen.findByRole('heading', { name: 'Account management' })
}
