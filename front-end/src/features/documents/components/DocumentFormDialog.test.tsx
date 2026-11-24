import { expect, it } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { documentStore } from '@/mocks/documents.ts'
import { dossierStore } from '@/mocks/dossierHandlers.ts'
import {
  renderDocumentRoute,
  documentServer,
  openCreateDraft,
} from '@/test/documentFeature.tsx'

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
it('selects and clears a record on draft create/edit and preserves a closed record', async () => {
  await renderDocumentRoute('/documents/incoming', 'employee')
  const { user, dialog } = await openCreateDraft()
  const form = within(dialog)
  await user.type(form.getByLabelText('Summary'), 'Draft linked to record')
  await user.selectOptions(form.getByLabelText('Document type'), '1')
  await user.selectOptions(form.getByLabelText('Urgency'), '4')
  await user.selectOptions(form.getByLabelText('Confidentiality'), '7')
  await user.selectOptions(form.getByLabelText('Issuing organization'), '1')
  await user.selectOptions(form.getByLabelText('Record'), '1')
  await user.click(form.getByRole('button', { name: 'Create' }))

  await user.click(
    await screen.findByRole('link', { name: 'Draft linked to record' }),
  )
  await screen.findByRole('link', { name: /HS-2026-01/ })

  await user.click(screen.getByRole('button', { name: 'Edit draft' }))
  const edit = within(await screen.findByRole('dialog', { name: 'Edit draft' }))
  await waitFor(() =>
    expect(edit.getByRole('button', { name: 'Save' })).toBeEnabled(),
  )
  expect(edit.getByLabelText('Record')).toHaveValue('1')
  await user.selectOptions(edit.getByLabelText('Record'), '')
  await user.click(edit.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByRole('link', { name: /HS-2026-01/ })).toBeNull()
})
it('keeps a closed record disabled and preserved on draft update, and surfaces server 409 message', async () => {
  documentStore.documents[0].dossierId = 2
  const view = await renderDocumentRoute('/documents/1', 'employee')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit draft' }))
  const edit = within(await screen.findByRole('dialog', { name: 'Edit draft' }))
  await waitFor(() =>
    expect(edit.getByRole('button', { name: 'Save' })).toBeEnabled(),
  )
  const recordSelect = edit.getByLabelText('Record')
  expect(recordSelect).toBeDisabled()
  expect(recordSelect).toHaveValue('2')
  expect(
    edit.getByRole('option', { name: /HS-2026-02.*\(closed\)/ }),
  ).toBeInTheDocument()
  await user.clear(edit.getByLabelText('Summary'))
  await user.type(edit.getByLabelText('Summary'), 'Edited inside closed record')
  await user.click(edit.getByRole('button', { name: 'Save' }))
  await screen.findByRole('heading', { name: 'Edited inside closed record' })
  expect(screen.getByRole('link', { name: /HS-2026-02/ })).toHaveAttribute(
    'href',
    '/records/2',
  )
  view.unmount()

  await renderDocumentRoute('/documents/incoming', 'employee')
  const create = await openCreateDraft()
  const createForm = within(create.dialog)
  await create.user.type(
    createForm.getByLabelText('Summary'),
    'Blocked by closed dossier',
  )
  for (const [label, value] of [
    ['Document type', '1'],
    ['Urgency', '4'],
    ['Confidentiality', '7'],
    ['Issuing organization', '1'],
  ])
    await create.user.selectOptions(createForm.getByLabelText(label), value)
  documentServer.use(
    http.post('/api/documents', () =>
      HttpResponse.json(
        { message: 'Cannot attach document to a closed record.' },
        { status: 409 },
      ),
    ),
  )
  await create.user.click(createForm.getByRole('button', { name: 'Create' }))
  expect(await createForm.findByRole('alert')).toHaveTextContent(
    'Cannot attach document to a closed record.',
  )
})
it('preserves dossierId for ADMIN without requesting /api/dossiers when dossier summary is absent', async () => {
  documentStore.documents[0].dossierId = 1
  let dossierRequests = 0
  documentServer.use(
    http.get('/api/dossiers', () => {
      dossierRequests++
      return new HttpResponse(null, { status: 403 })
    }),
    http.get('/api/dossiers/*', () => {
      dossierRequests++
      return new HttpResponse(null, { status: 403 })
    }),
    http.get('/api/documents/1', () =>
      HttpResponse.json({
        ...documentStore.documents[0],
        dossier: undefined,
      }),
    ),
  )
  await renderDocumentRoute('/documents/1', 'admin')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit draft' }))
  const edit = within(await screen.findByRole('dialog', { name: 'Edit draft' }))
  await waitFor(() =>
    expect(edit.getByRole('button', { name: 'Save' })).toBeEnabled(),
  )
  expect(edit.queryByRole('combobox', { name: 'Record' })).toBeNull()
  expect(edit.getByText('Record #1')).toBeVisible()
  expect(dossierRequests).toBe(0)

  await user.clear(edit.getByLabelText('Summary'))
  await user.type(edit.getByLabelText('Summary'), 'Admin edited draft')
  await user.click(edit.getByRole('button', { name: 'Save' }))
  await screen.findByRole('heading', { name: 'Admin edited draft' })
  expect(documentStore.documents[0].dossierId).toBe(1)
  expect(dossierRequests).toBe(0)
})
it('refreshes dossier closed state on 409 reload and locks Record select', async () => {
  documentStore.documents[0].dossierId = 1
  documentServer.use(
    http.get('/api/documents/1', () =>
      HttpResponse.json({
        ...documentStore.documents[0],
        dossier: undefined,
      }),
    ),
  )
  await renderDocumentRoute('/documents/1', 'employee')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit draft' }))
  const edit = within(await screen.findByRole('dialog', { name: 'Edit draft' }))
  await waitFor(() =>
    expect(edit.getByRole('button', { name: 'Save' })).toBeEnabled(),
  )
  expect(edit.getByLabelText('Record')).toBeEnabled()
  expect(edit.getByLabelText('Record')).toHaveValue('1')

  documentStore.documents[0].version++
  dossierStore.dossiers[0].closed = true

  await user.clear(edit.getByLabelText('Summary'))
  await user.type(edit.getByLabelText('Summary'), 'Stale edit before reload')
  await user.click(edit.getByRole('button', { name: 'Save' }))
  await edit.findByRole('alert')

  await user.click(
    edit.getByRole('button', { name: 'Discard changes and reload' }),
  )
  await waitFor(() =>
    expect(edit.getByRole('button', { name: 'Save' })).toBeEnabled(),
  )
  expect(edit.getByLabelText('Record')).toBeDisabled()
  expect(edit.getByLabelText('Record')).toHaveValue('1')
  expect(
    edit.getByRole('option', { name: /HS-2026-01.*\(closed\)/ }),
  ).toBeInTheDocument()

  await user.clear(edit.getByLabelText('Summary'))
  await user.type(edit.getByLabelText('Summary'), 'Saved after reload')
  await user.click(edit.getByRole('button', { name: 'Save' }))
  await screen.findByRole('heading', { name: 'Saved after reload' })
  expect(documentStore.documents[0].dossierId).toBe(1)
})
