import { useCallback } from 'react'
import Button from '@/shared/components/Button.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import {
  attachmentsApi,
  formatFileSize,
  isPreviewableMime,
} from '@/features/documents/api/attachmentsApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import type { DocumentAttachment } from '@/features/documents/types.ts'

export interface AttachmentVersionsPanelProps {
  documentId: number
  attachmentId: number
  onPreview: (version: DocumentAttachment) => void
  onDownload: (version: DocumentAttachment) => void
}

export default function AttachmentVersionsPanel({
  documentId,
  attachmentId,
  onPreview,
  onDownload,
}: AttachmentVersionsPanelProps) {
  const { data, error, loading, retry } = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        attachmentsApi.versions(documentId, attachmentId, signal),
      [documentId, attachmentId],
    ),
  )

  if (loading) {
    return (
      <p role="status" className="mt-3 text-sm text-neutral-400">
        Loading versions…
      </p>
    )
  }

  if (error) {
    return (
      <p role="alert" className="mt-3 text-sm text-red-300">
        {documentError(error).message}{' '}
        <Button variant="secondary" onClick={retry}>
          Retry versions
        </Button>
      </p>
    )
  }

  if (!data?.length) {
    return (
      <p className="mt-3 text-sm text-neutral-400">No versions available.</p>
    )
  }

  return (
    <ul
      aria-label="Attachment versions"
      className="mt-3 space-y-2 border-t border-neutral-800 pt-3"
    >
      {data.map((version) => (
        <li
          key={version.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-neutral-950/60 px-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-neutral-100">
                v{version.versionNo}
              </span>
              {version.isCurrent && (
                <span className="rounded-full border border-emerald-700 bg-emerald-950/60 px-2 py-0.5 text-xs text-emerald-300">
                  Current
                </span>
              )}
              <span className="break-words text-neutral-300">
                {version.fileName}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {formatFileSize(version.fileSize)} · User #{version.uploadedBy} ·{' '}
              <time dateTime={version.uploadedAt}>
                {new Date(version.uploadedAt).toLocaleString('en-GB')}
              </time>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isPreviewableMime(version.mimeType) && (
              <Button variant="secondary" onClick={() => onPreview(version)}>
                Preview
              </Button>
            )}
            <Button variant="secondary" onClick={() => onDownload(version)}>
              Download
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
