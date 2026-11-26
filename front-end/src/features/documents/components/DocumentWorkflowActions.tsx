import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '@/features/auth/context/useAuth.ts'
import Button from '@/shared/components/Button.tsx'
import { ConfirmDeactivateDialog } from '@/shared/components/CrudPageLayout.tsx'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import { documentWorkflowApi } from '@/features/documents/api/documentWorkflowApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import { canRunWorkflowAction } from '@/features/documents/permissions.ts'
import type {
  DocumentDetail,
  WorkflowCommand,
} from '@/features/documents/types.ts'
import SubmitForApprovalDialog from '@/features/documents/components/SubmitForApprovalDialog.tsx'
import WorkflowReasonDialog from '@/features/documents/components/WorkflowReasonDialog.tsx'

type Action = WorkflowCommand['action']
const labels: Record<Action, string> = {
  submit: 'Submit for approval',
  approve: 'Approve',
  reject: 'Reject document',
  publish: 'Issue number and publish',
  recall: 'Recall document',
}
const success: Record<Action, string> = {
  submit: 'Document submitted for approval.',
  approve: 'Document approved.',
  reject: 'Document rejected.',
  publish: 'Document published.',
  recall: 'Document recalled.',
}

export default function DocumentWorkflowActions({
  document: doc,
  onDocumentChanged,
  onLockedChange,
  onNotice,
  onUnavailable,
  focusHeading,
}: {
  document: DocumentDetail
  onDocumentChanged: (document: DocumentDetail) => void
  onLockedChange: (locked: boolean) => void
  onNotice: (message: string) => void
  onUnavailable: (message: string) => void
  focusHeading: () => void
}) {
  const { user } = useAuth()
  const [dialog, setDialog] = useState<Exclude<Action, 'approve'> | null>(null)
  const [pending, setPending] = useState(false)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const request = useRef<AbortController | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const headingFocus = useRef(focusHeading)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    const element = dialogRef.current
    if (!dialog || !element) return
    const trigger = opener.current
    const focusFallback = headingFocus.current
    element.showModal()
    return () => {
      element.close()
      if (trigger?.isConnected && !trigger.matches(':disabled')) trigger.focus()
      else focusFallback()
    }
  }, [dialog])

  function lock(value: boolean) {
    setLocked(value)
    onLockedChange(value)
  }

  function close() {
    setDialog(null)
    setFields({})
    if (!locked) setError('')
  }

  async function readLatest(signal: AbortSignal) {
    try {
      const fresh = await documentsApi.get(doc.id, signal)
      if (signal.aborted) return
      onDocumentChanged(fresh)
      setDialog(null)
      setFields({})
      setError('')
      lock(false)
      focusHeading()
    } catch (caught) {
      if (signal.aborted) return
      const failure = documentError(caught)
      if (failure.status === 403 || failure.status === 404)
        onUnavailable(failure.message)
      else setError(failure.message)
    }
  }

  async function perform(command?: WorkflowCommand) {
    if (
      request.current ||
      (command && (locked || !canRunWorkflowAction(user, doc, command.action)))
    )
      return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError('')
    setFields({})
    if (command) onNotice('')
    try {
      if (!command) {
        await readLatest(controller.signal)
        return
      }
      const fresh = await documentWorkflowApi.transition(
        doc.id,
        command,
        controller.signal,
      )
      if (controller.signal.aborted) return
      onNotice(success[command.action])
      setDialog(null)
      if (fresh) onDocumentChanged(fresh)
      else {
        lock(true)
        await readLatest(controller.signal)
      }
      if (command.action === 'approve') focusHeading()
    } catch (caught) {
      if (controller.signal.aborted) return
      const failure = documentError(caught)
      setError(failure.message)
      setFields(failure.fields)
      if (
        failure.status === 409 ||
        failure.status === 403 ||
        failure.status === 404
      )
        lock(true)
      else {
        const first = dialogRef.current?.querySelector<HTMLElement>(
          Object.hasOwn(failure.fields, 'reason') ? '#reason' : '#reviewerId',
        )
        if (Object.keys(failure.fields).length) first?.focus()
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setPending(false)
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const input = new FormData(form)
    if (dialog === 'submit') {
      const reviewerId = Number(input.get('reviewerId'))
      if (reviewerId > 0)
        void perform({ action: dialog, reviewerId, version: doc.version })
      else {
        setFields({ reviewerId: 'Choose a reviewer.' })
        ;(
          form.elements.namedItem('reviewerId') as HTMLSelectElement | null
        )?.focus()
      }
    } else if (dialog === 'reject' || dialog === 'recall') {
      const reason = String(input.get('reason') ?? '').trim()
      if (reason) void perform({ action: dialog, reason, version: doc.version })
      else {
        setFields({ reason: 'Enter a reason.' })
        ;(
          form.elements.namedItem('reason') as HTMLTextAreaElement | null
        )?.focus()
      }
    }
  }

  const reload = (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => void perform()}
    >
      Reload document
    </Button>
  )
  const form = {
    modalRef: dialogRef,
    titleId: 'document-workflow-title',
    title: dialog ? labels[dialog] : '',
    formKey: `${doc.id}-${doc.version}`,
    modalMessage: error,
    submitting: pending,
    isCreate: false,
    submitDisabled: locked,
    submitLabel: dialog ? labels[dialog] : '',
    pendingLabel: dialog === 'submit' ? 'Submitting…' : 'Processing…',
    secondaryAction: locked ? reload : undefined,
    onClose: close,
    onSubmit: submit,
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!locked &&
          (Object.keys(labels) as Action[])
            .filter((action) => canRunWorkflowAction(user, doc, action))
            .map((action) => (
              <Button
                key={action}
                disabled={pending}
                variant={
                  action === 'reject' || action === 'recall'
                    ? 'secondary'
                    : 'primary'
                }
                onClick={(event) => {
                  if (action === 'approve')
                    void perform({ action, version: doc.version })
                  else {
                    opener.current = event.currentTarget
                    setError('')
                    setDialog(action)
                  }
                }}
              >
                {action === 'reject' ? 'Reject' : labels[action]}
              </Button>
            ))}
      </div>
      {!dialog && error && <p role="alert">{error}</p>}
      {!dialog && locked && reload}
      {dialog === 'submit' && (
        <SubmitForApprovalDialog
          {...form}
          documentId={doc.id}
          reviewerError={fields.reviewerId}
        />
      )}
      {(dialog === 'reject' || dialog === 'recall') && (
        <WorkflowReasonDialog
          {...form}
          reasonError={fields.reason}
          documentNumber={dialog === 'recall' ? doc.documentNumber : undefined}
        />
      )}
      {dialog === 'publish' && (
        <ConfirmDeactivateDialog
          confirmModalRef={dialogRef}
          confirmTitleId={form.titleId}
          title={labels.publish}
          description="A document number will be assigned and the document will be published."
          errorMessage={error}
          submitting={pending}
          danger={false}
          confirmLabel={locked ? 'Reload document' : labels.publish}
          pendingLabel="Publishing…"
          onClose={close}
          onConfirm={() =>
            void perform(
              locked ? undefined : { action: 'publish', version: doc.version },
            )
          }
        />
      )}
    </>
  )
}
