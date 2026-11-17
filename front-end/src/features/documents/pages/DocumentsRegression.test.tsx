import { expect, it } from 'vitest'
import { fireEvent, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { documentServer, renderDocumentRoute } from '@/test/documentFeature.tsx'
import { documentStore } from '@/mocks/documents.ts'
import { categoryApi } from '@/features/categories/api/categoryApi.ts'

it('ignores an older response after a filter changes', async () => {
  documentServer.use(
    http.get('/api/documents', async ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      if (status === 'DRAFT') await delay(180)
      return HttpResponse.json({
        content: [
          {
            ...documentStore.documents[0],
            status: status ?? 'DRAFT',
            summary: status ?? 'Initial',
          },
        ],
        totalElements: 1,
        totalPages: 1,
        page: 0,
        size: 10,
      })
    }),
  )
  await renderDocumentRoute()
  await screen.findByRole('link', { name: 'Initial' })
  const filter = screen.getByRole('combobox', { name: 'Filter by status' })
  fireEvent.change(filter, { target: { value: 'DRAFT' } })
  fireEvent.change(filter, { target: { value: 'PUBLISHED' } })
  await screen.findByRole('link', { name: 'PUBLISHED' })
  await new Promise((resolve) => setTimeout(resolve, 220))
  expect(screen.queryByRole('link', { name: 'DRAFT' })).toBeNull()
})
it('clamps the last page after deleting its only row', async () => {
  documentStore.documents = documentStore.documents.slice(0, 11)
  const user = userEvent.setup()
  await renderDocumentRoute('/documents/incoming?page=1')
  await user.click(
    await screen.findByRole('button', { name: 'Delete Incoming document 1' }),
  )
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Delete draft?' }),
  )
  await user.click(dialog.getByRole('button', { name: 'Delete draft' }))
  await screen.findByText('Page 1 / 1')
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11)
})
it('prevents duplicate DELETE and all pending dialog closes', async () => {
  let requests = 0
  documentServer.use(
    http.delete('/api/documents/1', async () => {
      requests++
      await delay(200)
      return new HttpResponse(null, { status: 500 })
    }),
  )
  const user = userEvent.setup()
  await renderDocumentRoute('/documents/1')
  await user.click(await screen.findByRole('button', { name: 'Delete draft' }))
  const element = await screen.findByRole('dialog', { name: 'Delete draft?' })
  const dialog = within(element)
  const confirm = dialog.getByRole('button', { name: 'Delete draft' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  fireEvent.click(element)
  fireEvent(element, new Event('cancel', { cancelable: true }))
  expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  await dialog.findByRole('alert')
  expect(requests).toBe(1)
})
it('keeps an inactive lookup on edit and refreshes stale status after explicit reload', async () => {
  const user = userEvent.setup()
  await renderDocumentRoute('/documents/1')
  await screen.findByRole('button', { name: 'Edit draft' })
  await categoryApi.deactivate(1)
  await user.click(screen.getByRole('button', { name: 'Edit draft' }))
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Edit draft' }),
  )
  await dialog.findByRole('option', { name: 'Decision (inactive)' })
  expect(dialog.getByLabelText('Document type')).toHaveValue('1')
  documentStore.documents[0].status = 'PUBLISHED'
  documentStore.documents[0].version++
  await user.click(dialog.getByRole('button', { name: 'Save' }))
  await dialog.findByRole('alert')
  await user.click(
    dialog.getByRole('button', { name: 'Discard changes and reload' }),
  )
  if (screen.queryByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Edit draft' })).toBeNull(),
  )
  expect(screen.getByText('Published')).toBeVisible()
})
it('shows unknown status without edit or delete and does not leak denied tab data', async () => {
  documentStore.documents[0].status = 'FUTURE_STATUS'
  await renderDocumentRoute('/documents/1')
  await screen.findByText('Unknown')
  expect(screen.queryByRole('button', { name: 'Edit draft' })).toBeNull()
  documentServer.use(
    http.get(
      '/api/documents/1/history',
      () => new HttpResponse(null, { status: 403 }),
    ),
  )
  await userEvent.click(screen.getByRole('tab', { name: 'Status history' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/permission/)
  expect(screen.queryByRole('list', { name: 'Status history' })).toBeNull()
})
it('shows unavailable URL filters explicitly and allows clearing them', async () => {
  await renderDocumentRoute(
    '/documents/incoming?documentTypeId=999&departmentId=998',
  )
  await screen.findByText('No documents match these filters.')
  const type = screen.getByRole('combobox', { name: 'Filter by type' })
  const department = screen.getByRole('combobox', {
    name: 'Filter by department',
  })
  expect(type).toHaveDisplayValue('Unavailable type (#999)')
  expect(department).toHaveDisplayValue('Unavailable department (#998)')
  await userEvent.selectOptions(type, '')
  await userEvent.selectOptions(department, '')
  await screen.findByText('30 documents')
})
