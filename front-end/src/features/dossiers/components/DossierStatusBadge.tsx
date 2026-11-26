export default function DossierStatusBadge({ closed }: { closed: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs whitespace-nowrap ${
        closed
          ? 'text-neutral-300 bg-neutral-800'
          : 'text-emerald-200 bg-emerald-950/50'
      }`}
    >
      {closed ? 'Closed' : 'Open'}
    </span>
  )
}
