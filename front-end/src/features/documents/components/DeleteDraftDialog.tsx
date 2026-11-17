import { useEffect, useRef, useState } from 'react'
import { ConfirmDeactivateDialog } from '@/shared/components/CrudPageLayout.tsx'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import type { DocumentDetail } from '@/features/documents/types.ts'

type Props = {
  document: DocumentDetail
  onClose: () => void
  onDeleted: () => void
  onConflict: () => void
}
export default function DeleteDraftDialog({
  document,
  onClose,
  onDeleted,
  onConflict,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const pending = useRef<AbortController | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ReturnType<typeof documentError> | null>(
    null,
  )
  useEffect(() => {
    const trigger = window.document.activeElement as HTMLElement | null
    const dialog = ref.current!
    dialog.showModal()
    return () => {
      pending.current?.abort()
      dialog.close()
      trigger?.focus()
    }
  }, [])
  async function remove() {
    if (pending.current) return
    if (error?.status === 409 || error?.status === 404) {
      onConflict()
      return
    }
    const controller = new AbortController()
    pending.current = controller
    setSubmitting(true)
    try {
      await documentsApi.remove(
        document.id,
        document.version,
        controller.signal,
      )
      if (!controller.signal.aborted) onDeleted()
    } catch (caught) {
      if (!controller.signal.aborted) setError(documentError(caught))
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null
        setSubmitting(false)
      }
    }
  }
  return (
    <ConfirmDeactivateDialog
      confirmModalRef={ref}
      confirmTitleId="delete-draft-title"
      title="Delete draft?"
      description={<>Delete “{document.summary}”? This cannot be undone.</>}
      errorMessage={error?.message}
      submitting={submitting}
      confirmLabel={
        error?.status === 409 || error?.status === 404
          ? 'Reload document'
          : 'Delete draft'
      }
      pendingLabel="Deleting…"
      onClose={onClose}
      onConfirm={remove}
    />
  )
}
