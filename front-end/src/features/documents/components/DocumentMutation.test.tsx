import { expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import {
  documentServer,
  openCreateDraft,
  renderDocumentRoute,
} from '@/test/documentFeature.tsx'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'

async function fillDraft() {
  const { user, dialog } = await openCreateDraft()
  const form = within(dialog)
  await user.type(form.getByLabelText('Summary'), 'Mutation test')
  for (const [label, value] of [
    ['Document type', '1'],
    ['Urgency', '4'],
    ['Confidentiality', '7'],
    ['Issuing organization', '1'],
  ])
    await user.selectOptions(form.getByLabelText(label), value)
  const department = form.getByLabelText('Responsible department')
  if (!(department as HTMLSelectElement).disabled)
    await user.selectOptions(department, '2')
  return { user, dialog, form }
}
it('uses the staff department and creates in the current direction', async () => {
  await renderDocumentRoute('/documents/internal', 'employee')
  const { user, form } = await fillDraft()
  expect(form.getByLabelText('Responsible department')).toBeDisabled()
  expect(form.getByLabelText('Responsible department')).toHaveValue('1')
  await user.click(form.getByRole('button', { name: 'Create' }))
  await screen.findByRole('link', { name: 'Mutation test' })
})
it('retains input and focuses API field errors, with one request while pending', async () => {
  let requests = 0
  documentServer.use(
    http.post('/api/documents', async () => {
      requests++
      await delay(150)
      return HttpResponse.json(
        { fieldErrors: { summary: 'Summary rejected' } },
        { status: 422 },
      )
    }),
  )
  await renderDocumentRoute()
  const { form, dialog } = await fillDraft()
  const submit = form.getByRole('button', { name: 'Create' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(form.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  await form.findByText('Summary rejected')
  expect(form.getByLabelText('Summary')).toHaveValue('Mutation test')
  expect(form.getByLabelText('Summary')).toHaveFocus()
  expect(requests).toBe(1)
})
it('aborts a pending create when the route unmounts', async () => {
  documentServer.use(
    http.post('/api/documents', async () => {
      await delay(250)
      return new HttpResponse(null, { status: 500 })
    }),
  )
  const spy = vi.spyOn(documentsApi, 'create')
  try {
    const view = await renderDocumentRoute()
    const { user, form } = await fillDraft()
    await user.click(form.getByRole('button', { name: 'Create' }))
    const signal = spy.mock.calls[0][1]
    view.unmount()
    expect(signal?.aborted).toBe(true)
  } finally {
    spy.mockRestore()
  }
})
