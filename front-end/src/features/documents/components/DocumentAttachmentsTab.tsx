import { useCallback } from 'react'
import Button from '../../../shared/components/Button.tsx'
import { useFetch } from '../../../shared/hooks/useFetch.ts'
import { documentsApi } from '../api/documentsApi.ts'
import { documentError } from '../api/documentErrors.ts'

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
  return (
    <>
      <p className="mb-5 text-sm text-neutral-400">
        File upload and download are not available yet.
        {!canManage && ' This document is read-only.'}
      </p>
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
            </li>
          ))}
        </ul>
      ) : (
        <p>No attachments yet.</p>
      )}
    </>
  )
}
