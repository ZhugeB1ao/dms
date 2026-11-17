import { beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from '@/mocks/handlers.ts'
import { authHttp, session } from '@/shared/api/http.ts'
import AuthProvider from '@/features/auth/context/AuthProvider.tsx'
import AppRouter from '@/app/router/AppRouter.tsx'

export const documentServer = setupServer(...handlers)
beforeAll(() => documentServer.listen({ onUnhandledFrame: 'error' }))
afterAll(() => documentServer.close())
afterEach(() => {
  documentServer.resetHandlers()
  resetMock()
  session.clear()
})
export async function renderDocumentRoute(
  path = '/documents/incoming',
  username = 'admin',
) {
  const { data } = await authHttp.post('/auth/login', {
    username,
    password: 'Demo12345!',
  })
  session.set(data.accessToken, data.refreshToken)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </MemoryRouter>,
  )
}
export async function openCreateDraft() {
  const user = (await import('@testing-library/user-event')).default.setup()
  await user.click(
    await screen.findByRole('button', { name: '+ Create draft' }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'Create draft' })
  await within(dialog).findByRole('option', { name: 'Decision' })
  return { user, dialog }
}
