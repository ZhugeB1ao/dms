import { documentStatuses } from '../types.ts'

export default function DocumentStatusBadge({ status }: { status: string }) {
  const color =
    status === 'DRAFT'
      ? 'text-amber-200 bg-amber-950/50'
      : status === 'READY_TO_PUBLISH'
        ? 'text-sky-200 bg-sky-950/50'
        : status === 'PUBLISHED'
          ? 'text-emerald-200 bg-emerald-950/50'
          : 'text-neutral-300 bg-neutral-800'
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs whitespace-nowrap ${color}`}
    >
      {Object.hasOwn(documentStatuses, status)
        ? documentStatuses[status]
        : 'Unknown'}
    </span>
  )
}
