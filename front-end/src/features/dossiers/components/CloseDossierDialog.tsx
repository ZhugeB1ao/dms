import { useEffect, useId, useRef, useState } from 'react'
import { ConfirmDeactivateDialog } from '@/shared/components/CrudPageLayout.tsx'
import { dossiersApi } from '@/features/dossiers/api/dossiersApi.ts'
import { dossierError } from '@/features/dossiers/api/dossierErrors.ts'
import type { Dossier } from '@/features/dossiers/types.ts'

type Props = {
  dossier: Dossier
  onClose: () => void
  onClosed: (dossier: Dossier) => void
}

export default function CloseDossierDialog({
  dossier,
  onClose,
  onClosed,
}: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDialogElement>(null)
  const pending = useRef<AbortController | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ReturnType<typeof dossierError> | null>(
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

  async function confirmClose() {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setSubmitting(true)
    setError(null)
    try {
      const closed = await dossiersApi.close(dossier.id, controller.signal)
      if (!controller.signal.aborted) onClosed(closed)
    } catch (caught) {
      if (!controller.signal.aborted) setError(dossierError(caught))
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
      confirmTitleId={titleId}
      title="Close record?"
      description={
        <>
          Close “{dossier.code} — {dossier.name}”? Closing a record prevents
          editing details or attaching and detaching documents.
        </>
      }
      errorMessage={error?.message}
      submitting={submitting}
      confirmLabel="Close record"
      pendingLabel="Closing…"
      onClose={onClose}
      onConfirm={confirmClose}
    />
  )
}
