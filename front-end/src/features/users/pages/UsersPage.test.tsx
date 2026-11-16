import { expect, it } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import {
  renderAccountRoute,
  featureServer,
} from '../../../test/userFeature.tsx'

it('combines filters, resets the current page, and clears filters', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  await screen.findByRole('row', { name: /employee@demo.test/ })
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(await screen.findByText('Page 2 / 3')).toBeVisible()
  await waitFor(() =>
    expect(
      within(screen.getByLabelText('Filter by department')).getAllByRole(
        'option',
      ).length,
    ).toBeGreaterThan(1),
  )
  await user.selectOptions(screen.getByLabelText('Filter by department'), '2')
  await user.selectOptions(screen.getByLabelText('Filter by role'), 'EMPLOYEE')
  await user.selectOptions(screen.getByLabelText('Filter by status'), 'true')
  expect(await screen.findByText('5 accounts')).toBeVisible()
  expect(screen.getByText('Page 1 / 1')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(await screen.findByText('28 accounts')).toBeVisible()
}, 20000)
it('ignores a stale response that finishes after the latest filter', async () => {
  featureServer.use(
    http.get('http://localhost/api/accounts', async ({ request }) => {
      const role = new URL(request.url).searchParams.get('role')
      await delay(role === 'MANAGER' ? 600 : 10)
      return HttpResponse.json({
        content: [],
        page: 0,
        size: 10,
        totalElements: role === 'MANAGER' ? 99 : role === 'EMPLOYEE' ? 2 : 0,
        totalPages: 1,
      })
    }),
  )
  const user = userEvent.setup()
  await renderAccountRoute()
  await user.selectOptions(screen.getByLabelText('Filter by role'), 'MANAGER')
  await user.selectOptions(screen.getByLabelText('Filter by role'), 'EMPLOYEE')
  expect(await screen.findByText('2 accounts')).toBeVisible()
  await new Promise((r) => setTimeout(r, 700))
  expect(screen.queryByText('99 accounts')).toBeNull()
})
it('reports forbidden API errors without rendering a false success', async () => {
  featureServer.use(
    http.get('http://localhost/api/accounts', () =>
      HttpResponse.json(
        { code: 'FORBIDDEN', message: 'Forbidden' },
        { status: 403 },
      ),
    ),
  )
  await renderAccountRoute()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You do not have permission',
  )
})
it('shows an expired-session notice on the login page when refresh fails', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  await screen.findByRole('row', { name: /employee@demo.test/ })
  featureServer.use(
    http.get(
      'http://localhost/api/accounts',
      () => new HttpResponse(null, { status: 401 }),
    ),
    http.post(
      'http://localhost/api/auth/refresh',
      () => new HttpResponse(null, { status: 401 }),
    ),
  )
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Your session has expired',
  )
})
it('removes an inactive row from active results and moves back from an empty final page', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  await user.selectOptions(screen.getByLabelText('Filter by status'), 'true')
  await screen.findByText('22 accounts')
  await user.selectOptions(screen.getByLabelText('Rows per page'), '20')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled(),
  )
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('Page 2 / 2')
  for (let i = 0; i < 2; i++) {
    const table = screen.getByRole('table')
    const button = within(table).getAllByRole('button', {
      name: /^Deactivate /,
    })[0]
    await user.click(button)
    const dialog = await screen.findByRole('dialog', {
      name: 'Deactivate account',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await screen.findByText(`${21 - i} accounts`)
  }
  expect(await screen.findByText('Page 1 / 1')).toBeVisible()
})
it('searches by username or email and returns to the first page', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(await screen.findByText('Page 2 / 3')).toBeVisible()
  await user.type(screen.getByLabelText('Search accounts'), 'staff0')
  expect(await screen.findByText('9 accounts')).toBeVisible()
  expect(screen.getByText('Page 1 / 1')).toBeVisible()
})
it('does not call the API for each keystroke', async () => {
  const keywords: (string | null)[] = []
  featureServer.use(
    http.get('http://localhost/api/accounts', ({ request }) => {
      keywords.push(new URL(request.url).searchParams.get('keyword'))
      return HttpResponse.json({
        content: [],
        page: 0,
        size: 10,
        totalElements: keywords.length,
        totalPages: 1,
      })
    }),
  )
  const user = userEvent.setup()
  await renderAccountRoute()
  const initial = keywords.length
  await user.type(screen.getByLabelText('Search accounts'), 'staff01')
  await waitFor(() => expect(keywords.length).toBe(initial + 1))
  expect(keywords.at(-1)).toBe('staff01')
})
it('treats a whitespace-only keyword as no filter', async () => {
  const keywords: (string | null)[] = []
  featureServer.use(
    http.get('http://localhost/api/accounts', ({ request }) => {
      keywords.push(new URL(request.url).searchParams.get('keyword'))
      return HttpResponse.json({
        content: [],
        page: 0,
        size: 10,
        totalElements: 28,
        totalPages: 3,
      })
    }),
  )
  const user = userEvent.setup()
  await renderAccountRoute()
  const initial = keywords.length
  await user.type(screen.getByLabelText('Search accounts'), '   ')
  await new Promise((r) => setTimeout(r, 500))
  expect(keywords.length).toBe(initial)
  expect(keywords.every((k) => k === null)).toBe(true)
})
it('clears the search box with Clear filters and explains an empty result', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  const box = screen.getByLabelText('Search accounts')
  await user.type(box, 'zzzz')
  expect(
    await screen.findByText('No accounts match your filters.'),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(box).toHaveValue('')
  expect(await screen.findByText('28 accounts')).toBeVisible()
})
it('opens a read-only detail dialog when a row is clicked', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  const row = await screen.findByRole('row', { name: /employee@demo.test/ })
  await user.click(within(row).getByText('employee@demo.test'))
  const dialog = await screen.findByRole('dialog', { name: 'Account details' })
  expect(within(dialog).getByLabelText('Email')).toHaveValue(
    'employee@demo.test',
  )
  expect(within(dialog).getByLabelText('Email')).toBeDisabled()
  expect(
    within(dialog).queryByRole('button', { name: 'Save account' }),
  ).toBeNull()
  await user.click(within(dialog).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
