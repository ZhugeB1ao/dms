import { expect, it } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import {
  renderDocumentRoute,
  documentServer,
} from '../../../test/documentFeature.tsx'

it('pages and combines filters at the API, resets page and switches direction', async () => {
  const user = userEvent.setup()
  await renderDocumentRoute('/documents/incoming?page=1&size=10')
  await screen.findByText('Page 2 / 3')
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Filter by status' }),
    'DRAFT',
  )
  await screen.findByText('Page 1 / 1')
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Filter by department' }),
    '2',
  )
  await screen.findByText('5 documents')
  expect(within(screen.getByRole('table')).getAllByText('Draft')).toHaveLength(
    5,
  )
  await user.click(
    within(
      screen.getByRole('navigation', { name: 'Document directions' }),
    ).getByRole('link', { name: 'Outgoing' }),
  )
  await screen.findByRole('heading', { name: 'Outgoing documents' })
  await screen.findByText('30 documents')
  await user.click(
    within(
      screen.getByRole('navigation', { name: 'Document directions' }),
    ).getByRole('link', { name: 'Internal' }),
  )
  await screen.findByRole('heading', { name: 'Internal documents' })
  await screen.findByText('30 documents')
  const nav = within(screen.getByRole('navigation', { name: 'Navigation' }))
  expect(nav.getByRole('link', { name: 'Documents' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await user.click(
    within(screen.getByRole('table')).getByRole('link', {
      name: 'Internal document 90',
    }),
  )
  await screen.findByRole('heading', { name: 'Internal document 90' })
  expect(nav.getByRole('link', { name: 'Documents' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})
it('normalizes malformed query and allows retry after an API error', async () => {
  documentServer.use(
    http.get('/api/documents', () => new HttpResponse(null, { status: 500 })),
  )
  await renderDocumentRoute(
    '/documents/internal?page=NaN&size=7&departmentId=abc',
  )
  await screen.findByRole('alert')
  documentServer.resetHandlers()
  await userEvent.click(screen.getByRole('button', { name: 'Retry documents' }))
  await screen.findByText('Page 1 / 3')
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11)
})
it('removes document data after logout', async () => {
  await renderDocumentRoute()
  await screen.findByRole('table')
  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
  await waitFor(() =>
    expect(screen.queryByRole('table')).not.toBeInTheDocument(),
  )
})
