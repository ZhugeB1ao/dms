import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { setupServer } from 'msw/node'
import { delay, http, HttpResponse } from 'msw'
import { handlers, resetMock } from '@/mocks/handlers.ts'
import { authHttp, session } from '@/shared/api/http.ts'
import AuthProvider from '@/features/auth/context/AuthProvider.tsx'
import AppRouter from '@/app/router/AppRouter.tsx'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  resetMock()
  session.clear()
})

async function renderDetailRoute(path = '/records/1', username = 'employee') {
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

it('loads record metadata, attached documents linking to /documents/:id, and attaches an available document', async () => {
  const user = userEvent.setup()
  await renderDetailRoute('/records/1', 'employee')

  expect(
    await screen.findByRole('heading', { name: 'Recruitment 2026' }),
  ).toBeVisible()
  expect(screen.getByRole('link', { name: 'Back to records' })).toHaveAttribute(
    'href',
    '/records',
  )
  expect(screen.getByText(/HS-2026-01/)).toBeVisible()
  expect(screen.getByText('Open')).toBeVisible()
  expect(screen.getByText('1 document')).toBeVisible()

  const table = screen.getByRole('table', { name: 'Record documents' })
  expect(
    within(table).getByRole('link', { name: 'Incoming document 7' }),
  ).toHaveAttribute('href', '/documents/7')
  expect(within(table).getByText('Incoming')).toBeVisible()
  expect(within(table).getByText('Draft')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Attach document' }))
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Attach document' }),
  )
  await dialog.findByRole('option', { name: 'Incoming document 1' })
  await user.selectOptions(dialog.getByLabelText(/Document/i), '1')
  await user.click(dialog.getByRole('button', { name: 'Save' }))

  await screen.findByRole('link', { name: 'Incoming document 1' })
  expect(screen.getByText('2 documents')).toBeVisible()
})

it('detaches a document and prevents duplicate DELETE requests while pending', async () => {
  const user = userEvent.setup()
  await renderDetailRoute('/records/1', 'employee')

  const detachBtn = await screen.findByRole('button', {
    name: 'Detach Incoming document 7',
  })

  let deletes = 0
  server.use(
    http.delete('/api/dossiers/1/documents/7', async () => {
      deletes++
      await delay(150)
      return new HttpResponse(null, { status: 500 })
    }),
  )
  fireEvent.click(detachBtn)
  fireEvent.click(detachBtn)
  await screen.findByRole('alert')
  expect(deletes).toBe(1)

  server.resetHandlers()
  await user.click(
    screen.getByRole('button', { name: 'Detach Incoming document 7' }),
  )
  await screen.findByText('No documents attached to this record.')
  expect(screen.getByText('0 documents')).toBeVisible()
})

it('edits and closes a record from detail view, switching to read-only and hiding mutation actions', async () => {
  const user = userEvent.setup()
  await renderDetailRoute('/records/1', 'manager')

  await user.click(await screen.findByRole('button', { name: 'Edit record' }))
  const editDialog = within(
    await screen.findByRole('dialog', { name: 'Edit record' }),
  )
  await user.clear(editDialog.getByLabelText(/Record name/i))
  await user.type(
    editDialog.getByLabelText(/Record name/i),
    'Recruitment 2026 Revised',
  )
  await user.click(editDialog.getByRole('button', { name: 'Save' }))
  await screen.findByRole('heading', { name: 'Recruitment 2026 Revised' })

  await user.click(screen.getByRole('button', { name: 'Close record' }))
  const closeDialog = within(
    await screen.findByRole('dialog', { name: 'Close record?' }),
  )
  await user.click(closeDialog.getByRole('button', { name: 'Close record' }))

  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Edit record' })).toBeNull(),
  )
  expect(screen.queryByRole('button', { name: 'Close record' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Attach document' })).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Detach Incoming document 7' }),
  ).toBeNull()
  expect(screen.getByText('Closed')).toBeVisible()
  expect(screen.getByText(/read-only/i)).toBeVisible()
})

it('renders a closed record as read-only with its documents and no mutation controls', async () => {
  await renderDetailRoute('/records/2', 'employee')

  await screen.findByRole('heading', { name: 'Q1 Audit' })
  expect(screen.getByText('Closed')).toBeVisible()
  expect(screen.getByText(/read-only/i)).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Incoming document 9' }),
  ).toHaveAttribute('href', '/documents/9')
  expect(screen.getByText('Published')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Edit record' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Close record' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Attach document' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Detach/i })).toBeNull()
})

it('handles cross-department 404, invalid id param, and ADMIN 403', async () => {
  const crossDept = await renderDetailRoute('/records/4', 'employee')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /Record not found|no longer exists/i,
  )
  crossDept.unmount()
  session.clear()

  const invalid = await renderDetailRoute('/records/abc', 'employee')
  expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/)
  invalid.unmount()
  session.clear()

  await renderDetailRoute('/records/1', 'admin')
  expect(await screen.findByRole('heading', { name: /403/ })).toBeVisible()
})
