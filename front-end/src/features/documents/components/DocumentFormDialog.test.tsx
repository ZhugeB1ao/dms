import { expect, it } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
  renderDocumentRoute,
  documentServer,
  openCreateDraft,
} from '../../../test/documentFeature.tsx'

it('validates whitespace, creates and edits a draft through the shared form', async () => {
  await renderDocumentRoute()
  const { user, dialog } = await openCreateDraft()
  const form = within(dialog)
  await user.type(form.getByLabelText('Summary'), '   ')
  await user.click(form.getByRole('button', { name: 'Create' }))
  expect(form.getByLabelText('Summary')).toHaveFocus()
  await user.type(form.getByLabelText('Summary'), 'New board decision')
  await user.selectOptions(form.getByLabelText('Document type'), '1')
  await user.selectOptions(form.getByLabelText('Urgency'), '4')
  await user.selectOptions(form.getByLabelText('Confidentiality'), '7')
  await user.selectOptions(form.getByLabelText('Issuing organization'), '1')
  await user.selectOptions(form.getByLabelText('Responsible department'), '2')
  await user.click(form.getByRole('button', { name: 'Create' }))
  await screen.findByRole('link', { name: 'New board decision' })
  await user.click(
    screen.getByRole('button', { name: 'Edit New board decision' }),
  )
  const edit = within(await screen.findByRole('dialog', { name: 'Edit draft' }))
  await waitFor(() =>
    expect(edit.getByRole('button', { name: 'Save' })).toBeEnabled(),
  )
  await user.clear(edit.getByLabelText('Summary'))
  await user.type(edit.getByLabelText('Summary'), 'Revised board decision')
  await user.click(edit.getByRole('button', { name: 'Save' }))
  await screen.findByRole('link', { name: 'Revised board decision' })
})
it('keeps input after conflict and offers explicit reload', async () => {
  await renderDocumentRoute('/documents/1')
  const user = (await import('@testing-library/user-event')).default.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit draft' }))
  const form = within(await screen.findByRole('dialog', { name: 'Edit draft' }))
  await waitFor(() =>
    expect(form.getByRole('button', { name: 'Save' })).toBeEnabled(),
  )
  await user.clear(form.getByLabelText('Summary'))
  await user.type(form.getByLabelText('Summary'), 'Unsaved changes')
  documentServer.use(
    http.put('/api/documents/1', () => new HttpResponse(null, { status: 409 })),
  )
  await user.click(form.getByRole('button', { name: 'Save' }))
  expect(await form.findByRole('alert')).toHaveTextContent(/changed/)
  expect(form.getByLabelText('Summary')).toHaveValue('Unsaved changes')
  expect(
    form.getByRole('button', { name: 'Discard changes and reload' }),
  ).toBeVisible()
})
it('does not lock a create form after a 409', async () => {
  await renderDocumentRoute()
  const { user, dialog } = await openCreateDraft()
  const form = within(dialog)
  await user.type(form.getByLabelText('Summary'), 'Duplicate draft')
  for (const [label, value] of [
    ['Document type', '1'],
    ['Urgency', '4'],
    ['Confidentiality', '7'],
    ['Issuing organization', '1'],
    ['Responsible department', '2'],
  ])
    await user.selectOptions(form.getByLabelText(label), value)
  documentServer.use(
    http.post('/api/documents', () => new HttpResponse(null, { status: 409 })),
  )
  await user.click(form.getByRole('button', { name: 'Create' }))
  await form.findByRole('alert')
  expect(form.getByRole('button', { name: 'Create' })).toBeEnabled()
  expect(
    form.queryByRole('button', { name: 'Discard changes and reload' }),
  ).toBeNull()
})
it('locks saving while lookup fails and recovers on retry', async () => {
  documentServer.use(
    http.get('/api/organizations/active', () => HttpResponse.error()),
  )
  await renderDocumentRoute()
  const user = (await import('@testing-library/user-event')).default.setup()
  await user.click(
    await screen.findByRole('button', { name: '+ Create draft' }),
  )
  const form = within(
    await screen.findByRole('dialog', { name: 'Create draft' }),
  )
  await form.findByRole('button', { name: 'Retry options' })
  expect(form.getByRole('button', { name: 'Create' })).toBeDisabled()
  documentServer.resetHandlers()
  await user.click(form.getByRole('button', { name: 'Retry options' }))
  await waitFor(() =>
    expect(form.getByRole('button', { name: 'Create' })).toBeEnabled(),
  )
})
