import { useCallback } from 'react'
import Button from '@/shared/components/Button.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import { documentStatuses } from '@/features/documents/types.ts'

const statusLabel = (status: string) =>
  Object.hasOwn(documentStatuses, status) ? documentStatuses[status] : 'Unknown'

const actionLabels = {
  submit: 'Submitted for approval',
  approve: 'Approved',
  reject: 'Rejected',
  publish: 'Published',
  recall: 'Recalled',
}

export default function DocumentHistoryTab({
  documentId,
}: {
  documentId: number
}) {
  const { data, error, loading, retry } = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        documentsApi
          .history(documentId, signal)
          .then((entries) =>
            [...entries].sort(
              (a, b) =>
                Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
                b.id - a.id,
            ),
          ),
      [documentId],
    ),
  )
  if (loading) return <p role="status">Loading history…</p>
  if (error)
    return (
      <p role="alert">
        {documentError(error).message}{' '}
        <Button onClick={retry}>Retry history</Button>
      </p>
    )
  if (!data?.length) return <p>No status history yet.</p>
  return (
    <ol aria-label="Status history" className="space-y-5">
      {data.map((entry) => (
        <li key={entry.id} className="border-l-2 border-neutral-700 pl-4">
          <p>
            {entry.action && Object.hasOwn(actionLabels, entry.action)
              ? actionLabels[entry.action]
              : entry.fromStatus
                ? `${statusLabel(entry.fromStatus)} → ${statusLabel(entry.toStatus)}`
                : 'Draft created'}
          </p>
          <p className="text-sm text-neutral-400">
            {entry.actorName} ·{' '}
            <time dateTime={entry.occurredAt}>
              {new Date(entry.occurredAt).toLocaleString('en-GB')}
            </time>
          </p>
          {entry.note && <p className="mt-1">{entry.note}</p>}
        </li>
      ))}
    </ol>
  )
}
