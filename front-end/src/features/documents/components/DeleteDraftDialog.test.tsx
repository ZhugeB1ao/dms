import { expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderDocumentRoute, documentServer } from '@/test/documentFeature.tsx'

it('cancels without deleting, then confirms deletion and returns to the list', async () => {
  await renderDocumentRoute('/documents/1')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Delete draft' }))
  let dialog = within(
    await screen.findByRole('dialog', { name: 'Delete draft?' }),
  )
  await user.click(dialog.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('button', { name: 'Edit draft' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Delete draft' }))
  dialog = within(await screen.findByRole('dialog', { name: 'Delete draft?' }))
  await user.click(dialog.getByRole('button', { name: 'Delete draft' }))
  await screen.findByRole('heading', { name: 'Incoming documents' })
})
it('keeps the dialog and shows permission errors', async () => {
  await renderDocumentRoute('/documents/1')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Delete draft' }))
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Delete draft?' }),
  )
  documentServer.use(
    http.delete(
      '/api/documents/1',
      () => new HttpResponse(null, { status: 403 }),
    ),
  )
  await user.click(dialog.getByRole('button', { name: 'Delete draft' }))
  expect(await dialog.findByRole('alert')).toHaveTextContent(/permission/)
})
