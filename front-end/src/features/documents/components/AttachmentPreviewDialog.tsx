import { useEffect, useId, useRef, useState } from 'react'
import Button from '@/shared/components/Button.tsx'
import { isPreviewableMime } from '@/features/documents/api/attachmentsApi.ts'
import type {
  AttachmentSignedUrl,
  DocumentAttachment,
} from '@/features/documents/types.ts'

export interface AttachmentPreviewDialogProps {
  attachment: DocumentAttachment
  signedUrl: AttachmentSignedUrl | null
  loading: boolean
  error?: string | null
  onClose: () => void
  onRefreshLink: () => void
  onDownload: (attachment: DocumentAttachment) => void
}

function getRemainingSeconds(
  expiresAt: string | undefined,
  now: number,
): number {
  if (!expiresAt) return 0
  const ms = Date.parse(expiresAt) - now
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 1000) : 0
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`
}

export default function AttachmentPreviewDialog({
  attachment,
  signedUrl,
  loading,
  error,
  onClose,
  onRefreshLink,
  onDownload,
}: AttachmentPreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  const [prevExpiresAt, setPrevExpiresAt] = useState(signedUrl?.expiresAt)
  const [now, setNow] = useState(() => Date.now())

  if (signedUrl?.expiresAt !== prevExpiresAt) {
    setPrevExpiresAt(signedUrl?.expiresAt)
    setNow(Date.now())
  }

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => onCloseRef.current()
    dialog.addEventListener('close', handleClose)
    if (!dialog.open) dialog.showModal()

    let removeFallback: (() => void) | undefined
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (event: PointerEvent) => {
        const rect = dialog.getBoundingClientRect()
        return (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
      }
      let pressedOutside = false
      const onPointerDown = (event: PointerEvent) => {
        pressedOutside = outside(event)
      }
      const onPointerUp = (event: PointerEvent) => {
        if (pressedOutside && outside(event)) dialog.close()
        pressedOutside = false
      }
      dialog.addEventListener('pointerdown', onPointerDown)
      dialog.addEventListener('pointerup', onPointerUp)
      removeFallback = () => {
        dialog.removeEventListener('pointerdown', onPointerDown)
        dialog.removeEventListener('pointerup', onPointerUp)
      }
    }

    return () => {
      dialog.removeEventListener('close', handleClose)
      removeFallback?.()
      if (dialog.open) dialog.close()
    }
  }, [])

  const secondsLeft = signedUrl
    ? getRemainingSeconds(signedUrl.expiresAt, now)
    : 0
  const expired = Boolean(signedUrl) && secondsLeft <= 0
  const mime = attachment.mimeType.toLowerCase()

  useEffect(() => {
    if (!signedUrl?.expiresAt || expired) return
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(interval)
  }, [signedUrl?.expiresAt, expired])

  return (
    <dialog
      ref={dialogRef}
      className="preview-dialog"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="text-lg font-semibold break-words">
                {attachment.fileName}
              </h2>
              <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
                v{attachment.versionNo}
              </span>
            </div>
            {signedUrl && !loading && (
              <p role="status" className="text-sm text-neutral-400">
                {expired
                  ? 'Link expired'
                  : `Link expires in ${formatCountdown(secondsLeft)}`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {expired && (
              <Button variant="secondary" onClick={onRefreshLink}>
                Refresh link
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => onDownload(attachment)}
            >
              Download
            </Button>
            {signedUrl &&
              !expired &&
              signedUrl.disposition === 'inline' &&
              isPreviewableMime(mime) && (
                <a
                  href={signedUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button--secondary"
                >
                  Open in new tab
                </a>
              )}
            <Button
              variant="secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </Button>
          </div>
        </div>

        {loading && (
          <p role="status" className="text-sm text-neutral-400">
            Loading preview…
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200"
          >
            <span>{error}</span>
            <Button variant="secondary" onClick={onRefreshLink}>
              Refresh link
            </Button>
          </div>
        )}

        {!loading && signedUrl && !expired && (
          <div>
            {signedUrl.disposition === 'inline' &&
            mime === 'application/pdf' ? (
              <iframe
                src={signedUrl.url}
                title={attachment.fileName}
                className="h-[70dvh] w-full rounded-lg border border-neutral-800 bg-white"
              />
            ) : signedUrl.disposition === 'inline' &&
              isPreviewableMime(mime) ? (
              <div className="flex max-h-[70dvh] justify-center overflow-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                <img
                  src={signedUrl.url}
                  alt={attachment.fileName}
                  className="max-h-[65dvh] max-w-full object-contain"
                />
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                Inline preview is not available for this file. Use Download
                instead.
              </p>
            )}
          </div>
        )}
      </div>
    </dialog>
  )
}
