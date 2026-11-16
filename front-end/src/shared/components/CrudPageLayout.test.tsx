import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CrudFormDialog, ConfirmDeactivateDialog } from './CrudPageLayout.tsx'

it.each([false, true])(
  'guards every close path when submitting=%s',
  (submitting) => {
    const ref = createRef<HTMLDialogElement>()
    const onClose = vi.fn()
    render(
      <CrudFormDialog
        modalRef={ref}
        titleId="form-title"
        title="Draft"
        formKey="new"
        submitting={submitting}
        isCreate
        onClose={onClose}
        onSubmit={vi.fn()}
      >
        <input aria-label="Summary" />
      </CrudFormDialog>,
    )
    ref.current!.showModal()
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(ref.current!)
    fireEvent(ref.current!, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(submitting ? 0 : 4)
  },
)
it('disables submit while lookups are unavailable and exposes errors', () => {
  const ref = createRef<HTMLDialogElement>()
  render(
    <CrudFormDialog
      modalRef={ref}
      titleId="title"
      title="Draft"
      formKey="new"
      submitting={false}
      submitDisabled
      isCreate
      modalMessage="Lookup failed"
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    >
      <input />
    </CrudFormDialog>,
  )
  ref.current!.showModal()
  expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('Lookup failed')
})
it.each([false, true])(
  'customizes confirmation labels and guards pending close=%s',
  (submitting) => {
    const ref = createRef<HTMLDialogElement>()
    const onClose = vi.fn()
    render(
      <ConfirmDeactivateDialog
        confirmModalRef={ref}
        confirmTitleId="delete-title"
        title="Delete?"
        description="Draft"
        submitting={submitting}
        confirmLabel="Delete draft"
        pendingLabel="Deleting…"
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    )
    ref.current!.showModal()
    expect(
      screen.getByRole('button', {
        name: submitting ? 'Deleting…' : 'Delete draft',
      }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    fireEvent.click(ref.current!)
    fireEvent(ref.current!, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(submitting ? 0 : 3)
  },
)
