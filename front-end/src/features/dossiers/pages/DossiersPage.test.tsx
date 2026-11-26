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

async function renderRecordsRoute(path = '/records', username = 'employee') {
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

it('lists department-scoped records, filters by year and status, clears filters, and hides actions on closed rows', async () => {
  const user = userEvent.setup()
  await renderRecordsRoute()

  await screen.findByRole('heading', { name: 'Records' })
  const table = await screen.findByRole('table', { name: 'Records' })
  expect(
    within(table).getByRole('link', { name: 'HS-2026-01' }),
  ).toHaveAttribute('href', '/records/1')
  expect(
    within(table).getByRole('link', { name: 'Recruitment 2026' }),
  ).toHaveAttribute('href', '/records/1')
  expect(within(table).getByText('Q1 Audit')).toBeVisible()
  expect(within(table).getByText('Annual Archive 2025')).toBeVisible()
  expect(within(table).queryByText('Operations 2026')).toBeNull()

  expect(
    within(table).getByRole('button', { name: 'Edit HS-2026-01' }),
  ).toBeVisible()
  expect(
    within(table).getByRole('button', { name: 'Close HS-2026-01' }),
  ).toBeVisible()
  expect(
    within(table).queryByRole('button', { name: 'Edit HS-2026-02' }),
  ).toBeNull()
  expect(
    within(table).queryByRole('button', { name: 'Close HS-2026-02' }),
  ).toBeNull()

  const searchRegion = screen.getByRole('search')
  await user.selectOptions(
    within(searchRegion).getByRole('combobox', { name: 'Filter by year' }),
    '2025',
  )
  await screen.findByText('1 record')
  expect(within(table).getByText('Annual Archive 2025')).toBeVisible()
  expect(within(table).queryByText('Recruitment 2026')).toBeNull()

  await user.click(
    within(searchRegion).getByRole('button', { name: 'Clear filters' }),
  )
  await screen.findByText('3 records')

  await user.selectOptions(
    within(searchRegion).getByRole('combobox', { name: 'Filter by status' }),
    'true',
  )
  await screen.findByText('1 record')
  expect(within(table).getByText('Q1 Audit')).toBeVisible()
  expect(within(table).queryByText('Recruitment 2026')).toBeNull()
})

it('validates client inputs, surfaces 409 duplicate code focus, creates and edits a record', async () => {
  const user = userEvent.setup()
  await renderRecordsRoute()

  await user.click(await screen.findByRole('button', { name: '+ New record' }))
  const dialog = await screen.findByRole('dialog', { name: 'New record' })
  const form = within(dialog)

  const codeInput = form.getByLabelText(/Record code/i)
  const nameInput = form.getByLabelText(/Record name/i)
  const yearInput = form.getByLabelText(/Year/i)

  expect(codeInput).toHaveAttribute('autocorrect', 'off')
  expect(codeInput).toHaveAttribute('autocapitalize', 'none')
  expect(codeInput).toHaveAttribute('spellcheck', 'false')
  expect(yearInput).toHaveAttribute('type', 'text')
  expect(yearInput).toHaveAttribute('inputmode', 'numeric')
  expect(yearInput).toHaveAttribute('pattern', '\\d{4}')
  expect(yearInput).toHaveAttribute('maxlength', '4')

  await user.type(codeInput, '   ')
  await user.clear(yearInput)
  await user.type(yearInput, '1800')
  await user.click(form.getByRole('button', { name: 'Create' }))
  expect(codeInput).toHaveFocus()

  await user.clear(codeInput)
  await user.type(codeInput, 'HS-2026-01')
  await user.type(nameInput, 'Duplicate record')
  await user.clear(yearInput)
  await user.type(yearInput, '2026')
  await user.click(form.getByRole('button', { name: 'Create' }))

  expect(
    await form.findByText(/This record code already exists for this year/i),
  ).toBeVisible()
  expect(codeInput).toHaveFocus()
  expect(codeInput).toHaveValue('HS-2026-01')
  expect(nameInput).toHaveValue('Duplicate record')

  await user.clear(codeInput)
  await user.type(codeInput, 'HS-2026-09')
  await user.clear(nameInput)
  await user.type(nameInput, 'Board Minutes 2026')
  await user.click(form.getByRole('button', { name: 'Create' }))

  await screen.findByRole('link', { name: 'HS-2026-09' })
  expect(screen.getByText('4 records')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Edit HS-2026-09' }))
  const editDialog = within(
    await screen.findByRole('dialog', { name: 'Edit record' }),
  )
  await user.clear(editDialog.getByLabelText(/Record name/i))
  await user.type(
    editDialog.getByLabelText(/Record name/i),
    'Board Minutes Final',
  )
  await user.click(editDialog.getByRole('button', { name: 'Save' }))
  await screen.findByRole('link', { name: 'Board Minutes Final' })
})

it('closes an open record with confirmation and hides Edit and Close actions', async () => {
  const user = userEvent.setup()
  await renderRecordsRoute('/records', 'manager')

  await user.click(
    await screen.findByRole('button', { name: 'Close HS-2026-01' }),
  )
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Close record?' }),
  )
  expect(
    dialog.getByText(
      /prevents editing details or attaching and detaching documents/i,
    ),
  ).toBeVisible()
  await user.click(dialog.getByRole('button', { name: 'Close record' }))

  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Edit HS-2026-01' }),
    ).toBeNull(),
  )
  expect(screen.queryByRole('button', { name: 'Close HS-2026-01' })).toBeNull()
})

it('scopes records to caller department and denies ADMIN with 403', async () => {
  const view = await renderRecordsRoute('/records', 'other')
  await screen.findByRole('link', { name: 'Operations 2026' })
  expect(screen.queryByText('Recruitment 2026')).toBeNull()
  view.unmount()
  session.clear()

  await renderRecordsRoute('/records', 'admin')
  expect(await screen.findByRole('heading', { name: /403/ })).toBeVisible()
})

it('normalizes malformed query, allows retry on API error, and ignores stale filter responses', async () => {
  server.use(
    http.get('/api/dossiers', () => new HttpResponse(null, { status: 500 })),
  )
  await renderRecordsRoute('/records?page=NaN&size=7&year=bad&closed=maybe')
  await screen.findByRole('alert')

  server.resetHandlers()
  await userEvent.click(screen.getByRole('button', { name: 'Retry records' }))
  await screen.findByText('Page 1 / 1')
  expect(screen.getByRole('link', { name: 'HS-2026-01' })).toBeVisible()

  server.use(
    http.get('/api/dossiers', async ({ request }) => {
      const closed = new URL(request.url).searchParams.get('closed')
      if (closed === 'false') await delay(180)
      return HttpResponse.json({
        content: [
          {
            id: 99,
            code: closed === 'true' ? 'CLOSED-99' : 'OPEN-99',
            name: closed === 'true' ? 'Closed Result' : 'Open Result',
            year: 2026,
            departmentId: 1,
            closed: closed === 'true',
            documentCount: 0,
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        page: 0,
        size: 10,
      })
    }),
  )
  const filter = screen.getByRole('combobox', { name: 'Filter by status' })
  fireEvent.change(filter, { target: { value: 'false' } })
  fireEvent.change(filter, { target: { value: 'true' } })
  await screen.findByRole('link', { name: 'CLOSED-99' })
  await new Promise((resolve) => setTimeout(resolve, 220))
  expect(screen.queryByRole('link', { name: 'OPEN-99' })).toBeNull()
})
