import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import Button from '@/shared/components/Button.tsx'
import { ConfirmDeactivateDialog } from '@/shared/components/CrudPageLayout.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import {
  ACCEPT_ATTR,
  attachmentsApi,
  formatFileSize,
  isPreviewableMime,
  validateClientFile,
} from '@/features/documents/api/attachmentsApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import AttachmentPreviewDialog from '@/features/documents/components/AttachmentPreviewDialog.tsx'
import AttachmentVersionsPanel from '@/features/documents/components/AttachmentVersionsPanel.tsx'
import type {
  AttachmentSignedUrl,
  DocumentAttachment,
} from '@/features/documents/types.ts'

interface PreviewState {
  attachment: DocumentAttachment
  signedUrl: AttachmentSignedUrl | null
  loading: boolean
  error: string | null
}

export default function DocumentAttachmentsTab({
  documentId,
  canManage,
}: {
  documentId: number
  canManage: boolean
}) {
  const { data, error, loading, retry, setData } = useFetch(
    useCallback(
      (signal: AbortSignal) => attachmentsApi.list(documentId, signal),
      [documentId],
    ),
  )

  const uploadInputId = useId()
  const confirmTitleId = useId()
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetRef = useRef<DocumentAttachment | null>(null)
  const confirmModalRef = useRef<HTMLDialogElement>(null)
  const mutationControllerRef = useRef<AbortController | null>(null)
  const presignControllerRef = useRef<AbortController | null>(null)
  const downloadControllerRef = useRef<AbortController | null>(null)
  const currentListRef = useRef(data)

  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(),
  )
  const [deleteTarget, setDeleteTarget] = useState<DocumentAttachment | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)

  const busy = uploading || deleting

  useEffect(() => {
    currentListRef.current = data
  }, [data])

  useEffect(() => {
    return () => {
      mutationControllerRef.current?.abort()
      presignControllerRef.current?.abort()
      downloadControllerRef.current?.abort()
    }
  }, [])

  async function runUpload(file: File, target?: DocumentAttachment) {
    if (mutationControllerRef.current) return
    const validationError = validateClientFile(file)
    if (validationError) {
      setActionError(validationError)
      setStatusMessage(null)
      return
    }
    const controller = new AbortController()
    mutationControllerRef.current = controller
    setUploading(true)
    setUploadProgress(null)
    setActionError(null)
    setStatusMessage(null)
    try {
      const options = {
        signal: controller.signal,
        onProgress: (percent: number) => {
          if (!controller.signal.aborted) setUploadProgress(percent)
        },
      }
      if (target) {
        const replaced = await attachmentsApi.replace(
          documentId,
          target.id,
          file,
          options,
        )
        if (controller.signal.aborted) return
        setData(
          (currentListRef.current ?? []).map((item) =>
            item.id === target.id ? replaced : item,
          ),
        )
        setStatusMessage(
          `Replaced "${target.fileName}" with "${replaced.fileName}" (v${replaced.versionNo}).`,
        )
      } else {
        const created = await attachmentsApi.upload(documentId, file, options)
        if (controller.signal.aborted) return
        setData([created, ...(currentListRef.current ?? [])])
        setStatusMessage(`Uploaded "${created.fileName}".`)
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setActionError(documentError(caught).message)
      }
    } finally {
      if (mutationControllerRef.current === controller) {
        mutationControllerRef.current = null
      }
      if (!controller.signal.aborted) {
        setUploading(false)
        setUploadProgress(null)
      }
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) void runUpload(file)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!busy) setDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragActive(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    if (busy) return
    const file = event.dataTransfer?.files?.[0]
    if (file) void runUpload(file)
  }

  function triggerReplace(file: DocumentAttachment) {
    if (busy) return
    replaceTargetRef.current = file
    replaceInputRef.current?.click()
  }

  function handleReplaceChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    const target = replaceTargetRef.current
    replaceTargetRef.current = null
    event.currentTarget.value = ''
    if (file && target) void runUpload(file, target)
  }

  async function openPreview(file: DocumentAttachment) {
    presignControllerRef.current?.abort()
    const controller = new AbortController()
    presignControllerRef.current = controller
    setPreviewState({
      attachment: file,
      signedUrl: null,
      loading: true,
      error: null,
    })
    try {
      const signedUrl = await attachmentsApi.getUrl(
        documentId,
        file.id,
        'inline',
        controller.signal,
      )
      if (
        controller.signal.aborted ||
        presignControllerRef.current !== controller
      )
        return
      setPreviewState({
        attachment: file,
        signedUrl,
        loading: false,
        error: null,
      })
    } catch (caught) {
      if (
        controller.signal.aborted ||
        presignControllerRef.current !== controller
      )
        return
      setPreviewState({
        attachment: file,
        signedUrl: null,
        loading: false,
        error: documentError(caught).message,
      })
    } finally {
      if (presignControllerRef.current === controller) {
        presignControllerRef.current = null
      }
    }
  }

  function closePreview() {
    presignControllerRef.current?.abort()
    presignControllerRef.current = null
    setPreviewState(null)
  }

  async function handleDownload(file: DocumentAttachment, fromPreview = false) {
    downloadControllerRef.current?.abort()
    const controller = new AbortController()
    downloadControllerRef.current = controller
    if (fromPreview) {
      setPreviewState((prev) => (prev ? { ...prev, error: null } : prev))
    } else {
      setActionError(null)
    }
    try {
      const signed = await attachmentsApi.getUrl(
        documentId,
        file.id,
        'attachment',
        controller.signal,
      )
      if (
        controller.signal.aborted ||
        downloadControllerRef.current !== controller
      )
        return
      const container = fromPreview
        ? (window.document.querySelector('dialog[open]') ??
          window.document.body)
        : window.document.body
      const link = window.document.createElement('a')
      link.href = signed.url
      link.download = file.fileName
      link.rel = 'noopener noreferrer'
      container.appendChild(link)
      link.click()
      link.remove()
    } catch (caught) {
      if (
        !controller.signal.aborted &&
        downloadControllerRef.current === controller
      ) {
        const message = documentError(caught).message
        if (fromPreview) {
          setPreviewState((prev) => (prev ? { ...prev, error: message } : prev))
        } else {
          setActionError(message)
        }
      }
    } finally {
      if (downloadControllerRef.current === controller) {
        downloadControllerRef.current = null
      }
    }
  }

  function toggleVersions(fileGroupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(fileGroupId)) next.delete(fileGroupId)
      else next.add(fileGroupId)
      return next
    })
  }

  function openDeleteDialog(file: DocumentAttachment) {
    if (mutationControllerRef.current) return
    setDeleteError(undefined)
    setDeleteTarget(file)
    if (!confirmModalRef.current?.open) confirmModalRef.current?.showModal()
  }

  function closeDeleteDialog() {
    if (deleting) return
    if (confirmModalRef.current?.open) confirmModalRef.current.close()
    setDeleteTarget(null)
    setDeleteError(undefined)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || mutationControllerRef.current) return
    const target = deleteTarget
    const controller = new AbortController()
    mutationControllerRef.current = controller
    setDeleting(true)
    setDeleteError(undefined)
    setActionError(null)
    setStatusMessage(null)
    try {
      await attachmentsApi.remove(documentId, target.id, controller.signal)
      if (controller.signal.aborted) return
      setData(
        (currentListRef.current ?? []).filter(
          (item) => item.fileGroupId !== target.fileGroupId,
        ),
      )
      setExpandedGroups((prev) => {
        const next = new Set(prev)
        next.delete(target.fileGroupId)
        return next
      })
      if (previewState?.attachment.fileGroupId === target.fileGroupId) {
        closePreview()
      }
      if (confirmModalRef.current?.open) confirmModalRef.current.close()
      setDeleteTarget(null)
      setStatusMessage(`Deleted "${target.fileName}".`)
    } catch (caught) {
      if (!controller.signal.aborted) {
        setDeleteError(documentError(caught).message)
      }
    } finally {
      if (mutationControllerRef.current === controller) {
        mutationControllerRef.current = null
      }
      if (!controller.signal.aborted) setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      {!canManage ? (
        <p className="text-sm text-neutral-400">This document is read-only.</p>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`space-y-3 rounded-xl border border-dashed p-5 transition-colors ${
            dragActive
              ? 'border-emerald-400 bg-emerald-950/20'
              : 'border-neutral-700 bg-neutral-950/60'
          }`}
        >
          <div className="space-y-1">
            <label htmlFor={uploadInputId} className="field-label font-medium">
              Upload attachment
            </label>
            <p className="text-xs text-neutral-400">
              Drag and drop a file here or choose a file. Allowed: PDF, PNG,
              JPG, WEBP, DOCX, XLSX (max 10 MB).
            </p>
          </div>
          <input
            id={uploadInputId}
            type="file"
            accept={ACCEPT_ATTR}
            disabled={busy}
            onChange={handleFileChange}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            tabIndex={-1}
            aria-label="Replace attachment file"
            className="sr-only"
            disabled={busy}
            onChange={handleReplaceChange}
          />
          {uploading && (
            <div className="space-y-2">
              <progress
                {...(uploadProgress !== null ? { value: uploadProgress } : {})}
                max={100}
                aria-label="Upload progress"
                className="w-full accent-emerald-400"
              />
              <p role="status" className="text-sm text-neutral-400">
                {uploadProgress !== null
                  ? `Uploading… ${uploadProgress}%`
                  : 'Uploading…'}
              </p>
            </div>
          )}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200"
        >
          {actionError}
        </div>
      )}

      {statusMessage && (
        <p role="status" className="text-sm text-emerald-300">
          {statusMessage}
        </p>
      )}

      {loading ? (
        <p role="status">Loading attachments…</p>
      ) : error ? (
        <p role="alert">
          {documentError(error).message}{' '}
          <Button onClick={retry}>Retry attachments</Button>
        </p>
      ) : data?.length ? (
        <ul aria-label="Attachments" className="space-y-4">
          {data.map((file) => {
            const versionsOpen = expandedGroups.has(file.fileGroupId)
            return (
              <li
                key={file.id}
                className="rounded-xl border border-neutral-800 p-4 break-words"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{file.fileName}</p>
                      <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
                        v{file.versionNo}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400">
                      {formatFileSize(file.fileSize)} · {file.mimeType}
                    </p>
                    <p className="text-sm text-neutral-400">
                      User #{file.uploadedBy} ·{' '}
                      <time dateTime={file.uploadedAt}>
                        {new Date(file.uploadedAt).toLocaleString('en-GB')}
                      </time>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isPreviewableMime(file.mimeType) && (
                      <Button
                        variant="secondary"
                        onClick={() => void openPreview(file)}
                      >
                        Preview
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => void handleDownload(file)}
                    >
                      Download
                    </Button>
                    <Button
                      variant="secondary"
                      aria-expanded={versionsOpen}
                      onClick={() => toggleVersions(file.fileGroupId)}
                    >
                      Versions
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => triggerReplace(file)}
                        >
                          Replace
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => openDeleteDialog(file)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {versionsOpen && (
                  <AttachmentVersionsPanel
                    documentId={documentId}
                    attachmentId={file.id}
                    onPreview={(version) => void openPreview(version)}
                    onDownload={(version) => void handleDownload(version)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p>No attachments yet.</p>
      )}

      {previewState && (
        <AttachmentPreviewDialog
          attachment={previewState.attachment}
          signedUrl={previewState.signedUrl}
          loading={previewState.loading}
          error={previewState.error}
          onClose={closePreview}
          onRefreshLink={() => void openPreview(previewState.attachment)}
          onDownload={(file) => void handleDownload(file, true)}
        />
      )}

      {canManage && (
        <ConfirmDeactivateDialog
          confirmModalRef={confirmModalRef}
          confirmTitleId={confirmTitleId}
          title="Delete attachment?"
          description={
            deleteTarget ? (
              <>
                Delete “{deleteTarget.fileName}” and all of its versions? This
                cannot be undone.
              </>
            ) : (
              ''
            )
          }
          errorMessage={deleteError}
          submitting={deleting}
          confirmLabel="Delete file"
          pendingLabel="Deleting…"
          onClose={closeDeleteDialog}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </div>
  )
}
