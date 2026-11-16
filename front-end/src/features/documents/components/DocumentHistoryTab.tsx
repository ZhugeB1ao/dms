import { useCallback } from 'react'
import Button from '../../../shared/components/Button.tsx'
import { useFetch } from '../../../shared/hooks/useFetch.ts'
import { documentsApi } from '../api/documentsApi.ts'
import { documentError } from '../api/documentErrors.ts'
import { documentStatuses } from '../types.ts'

const statusLabel = (status: string) =>
  Object.hasOwn(documentStatuses, status) ? documentStatuses[status] : 'Unknown'

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
              (a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id - b.id,
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
            {entry.fromStatus ? statusLabel(entry.fromStatus) : 'Created'} →{' '}
            {statusLabel(entry.toStatus)}
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
