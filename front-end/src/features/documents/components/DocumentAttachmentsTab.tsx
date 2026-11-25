import { useCallback, useEffect, useRef, useState } from 'react'
import Button from '@/shared/components/Button.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import { documentWorkflowApi } from '@/features/documents/api/documentWorkflowApi.ts'
import type { DocumentAttachment } from '@/features/documents/types.ts'

export default function DocumentAttachmentsTab({
  documentId,
  canManage,
}: {
  documentId: number
  canManage: boolean
}) {
  const { data, error, loading, retry } = useFetch(
    useCallback(
      (signal: AbortSignal) => documentsApi.attachments(documentId, signal),
      [documentId],
    ),
  )
  const request = useRef<AbortController | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  useEffect(() => () => request.current?.abort(), [documentId])

  async function download(file: DocumentAttachment) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setDownloading(true)
    setDownloadError('')
    try {
      const blob = await documentWorkflowApi.attachmentContent(
        documentId,
        file.id,
        controller.signal,
      )
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.fileName
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (caught) {
      if (controller.signal.aborted) return
      const status = documentError(caught).status
      setDownloadError(
        status === 403
          ? 'You do not have permission to download this attachment.'
          : status === 404
            ? 'This attachment no longer exists.'
            : 'Unable to download the attachment. Try again.',
      )
    } finally {
      if (request.current === controller) {
        request.current = null
        if (!controller.signal.aborted) setDownloading(false)
      }
    }
  }
  return (
    <>
      <p className="mb-5 text-sm text-neutral-400">
        {data?.some((file) => file.canDownload)
          ? 'File upload is not available yet.'
          : 'File upload and download are not available yet.'}
        {!canManage && ' This document is read-only.'}
      </p>
      {downloadError && <p role="alert">{downloadError}</p>}
      {downloading && <p role="status">Downloading attachment…</p>}
      {loading ? (
        <p role="status">Loading attachments…</p>
      ) : error ? (
        <p role="alert">
          {documentError(error).message}{' '}
          <Button onClick={retry}>Retry attachments</Button>
        </p>
      ) : data?.length ? (
        <ul aria-label="Attachments" className="space-y-4">
          {data.map((file) => (
            <li
              key={file.id}
              className="rounded-xl border border-neutral-800 p-4 break-words"
            >
              <p>{file.fileName}</p>
              <p className="text-sm text-neutral-400">
                {file.sizeBytes.toLocaleString('en-GB')} bytes ·{' '}
                {file.contentType}
              </p>
              <p className="text-sm text-neutral-400">
                {file.uploadedBy} ·{' '}
                <time dateTime={file.uploadedAt}>
                  {new Date(file.uploadedAt).toLocaleString('en-GB')}
                </time>
              </p>
              {file.canDownload && (
                <Button
                  variant="secondary"
                  disabled={downloading}
                  className="mt-3"
                  aria-label={`Download ${file.fileName}`}
                  onClick={() => void download(file)}
                >
                  Download
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No attachments yet.</p>
      )}
    </>
  )
}
