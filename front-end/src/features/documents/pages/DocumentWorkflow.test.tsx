import { expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { documentServer, renderDocumentRoute } from '@/test/documentFeature.tsx'
import { documentStore } from '@/mocks/documents.ts'

function seedPending() {
  const draft = documentStore.documents.find((doc) => doc.id === 31)!
  Object.assign(draft, {
    status: 'PENDING_APPROVAL',
    reviewerId: 2,
    reviewerName: 'manager',
    submittedAt: '2026-11-23T02:00:00Z',
    submittedByName: 'employee',
  })
}

it('submits a draft for a selected reviewer and locks editing', async () => {
  await renderDocumentRoute('/documents/31', 'employee')
  const user = userEvent.setup()
  const submit = await screen.findByRole('button', {
    name: 'Submit for approval',
  })
  await user.click(submit)
  const dialog = screen.getByRole('dialog', { name: 'Submit for approval' })
  await within(dialog).findByRole('option', { name: 'manager' })
  const reviewer = within(dialog).getByRole('combobox', { name: /reviewer/i })
  await user.click(
    within(dialog).getByRole('button', { name: 'Submit for approval' }),
  )
  expect(reviewer).toHaveFocus()
  await user.selectOptions(reviewer, '2')
  await user.click(
    within(dialog).getByRole('button', { name: 'Submit for approval' }),
  )
  await screen.findByText('Pending approval')
  expect(screen.queryByRole('button', { name: 'Edit draft' })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('returns to filtered inbox after rejecting a document with a reason', async () => {
  seedPending()
  await renderDocumentRoute(
    '/documents/pending-approvals?direction=OUTGOING',
    'manager',
  )
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('link', { name: 'Review Outgoing document 31' }),
  )
  await user.click(await screen.findByRole('tab', { name: 'Attachments' }))
  await screen.findByRole('button', { name: 'Download Review notes.txt' })
  await user.click(await screen.findByRole('button', { name: 'Reject' }))
  const dialog = screen.getByRole('dialog', { name: 'Reject document' })
  const reason = within(dialog).getByRole('textbox', { name: /reason/i })
  await user.type(reason, '   ')
  await user.click(
    within(dialog).getByRole('button', { name: 'Reject document' }),
  )
  expect(reason).toHaveFocus()
  await user.clear(reason)
  await user.type(reason, 'Wrong recipient')
  await user.click(
    within(dialog).getByRole('button', { name: 'Reject document' }),
  )
  await screen.findByText('Rejected')
  await user.click(screen.getByRole('tab', { name: 'Status history' }))
  await screen.findByText('Wrong recipient')
  await user.click(
    screen.getByRole('link', { name: 'Back to pending approvals' }),
  )
  await screen.findByText('No pending approvals match your filters.')
  expect(
    screen.getByRole('combobox', { name: 'Filter by direction' }),
  ).toHaveValue('OUTGOING')
})

it('requires an explicit reload after a stale decision', async () => {
  seedPending()
  await renderDocumentRoute('/documents/31', 'manager')
  const user = userEvent.setup()
  const approve = await screen.findByRole('button', { name: 'Approve' })
  const draft = documentStore.documents.find((doc) => doc.id === 31)!
  Object.assign(draft, { status: 'READY_TO_PUBLISH', version: 2 })
  await user.click(approve)
  await screen.findByRole('alert', { name: '' })
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Reload document' }))
  await screen.findByText('Ready to publish')
  expect(
    screen.getByRole('button', { name: 'Issue number and publish' }),
  ).toBeEnabled()
})

it('retries only the read when the acknowledged decision returns 204', async () => {
  seedPending()
  let writes = 0
  let reads = 0
  documentServer.use(
    http.post('/api/documents/31/workflow/transition', () => {
      writes += 1
      return new HttpResponse(null, { status: 204 })
    }),
    http.get('/api/documents/31', () => {
      reads += 1
      const draft = documentStore.documents.find((doc) => doc.id === 31)!
      if (reads === 2) return new HttpResponse(null, { status: 500 })
      return HttpResponse.json(
        reads === 1
          ? draft
          : { ...draft, status: 'READY_TO_PUBLISH', version: 2 },
      )
    }),
  )
  await renderDocumentRoute('/documents/31', 'manager')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Approve' }))
  await screen.findByText('Document approved.')
  const retry = await screen.findByRole('button', { name: 'Reload document' })
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
  await user.click(retry)
  await screen.findByText('Ready to publish')
  await waitFor(() => expect(writes).toBe(1))
})

it('keeps the acknowledgement if the reviewer loses read access after deciding', async () => {
  seedPending()
  let reads = 0
  documentServer.use(
    http.post(
      '/api/documents/31/workflow/transition',
      () => new HttpResponse(null, { status: 204 }),
    ),
    http.get('/api/documents/31', () => {
      reads += 1
      return reads === 1
        ? HttpResponse.json(
            documentStore.documents.find((doc) => doc.id === 31),
          )
        : new HttpResponse(null, { status: 403 })
    }),
  )
  await renderDocumentRoute('/documents/31', 'manager')
  await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/permission/)
  expect(screen.getByText('Document approved.')).toBeVisible()
  expect(screen.queryByRole('tab')).toBeNull()
  expect(reads).toBe(2)
})
