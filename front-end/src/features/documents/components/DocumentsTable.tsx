import { Link, useNavigate } from 'react-router'
import Button from '@/shared/components/Button.tsx'
import { DeleteIcon, EditIcon } from '@/shared/components/Icons.tsx'
import { crudRowIconClassName } from '@/shared/components/crudStyles.ts'
import type { User } from '@/shared/types/domain.ts'
import { canEditDraft } from '@/features/documents/permissions.ts'
import type { DocumentSummary } from '@/features/documents/types.ts'
import DocumentStatusBadge from '@/features/documents/components/DocumentStatusBadge.tsx'

export default function DocumentsTable({
  rows,
  user,
  busy,
  onEdit,
  onDelete,
}: {
  rows: DocumentSummary[]
  user: User | null
  busy: boolean
  onEdit: (id: number) => void
  onDelete: (id: number) => void
}) {
  const navigate = useNavigate()
  return (
    <div
      className="overflow-x-auto rounded-xl border border-[#292929]/80 bg-[#121212]/30"
      role="region"
      aria-label="Documents table"
      tabIndex={0}
    >
      <table className="data-table min-w-[900px]" aria-label="Documents">
        <thead>
          <tr>
            {[
              'Summary',
              'Document type',
              'Responsible department',
              'Issuing organization',
              'Status',
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
            <th scope="col" className="text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((doc) => (
            <tr
              key={doc.id}
              className="cursor-pointer transition-colors hover:bg-[#1e1e1e]/40"
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('a, button'))
                  void navigate(`/documents/${doc.id}`)
              }}
            >
              <td>
                <Link
                  className="text-link inline-block min-w-40 max-w-sm break-words"
                  to={`/documents/${doc.id}`}
                >
                  {doc.summary}
                </Link>
              </td>
              <td>{doc.documentTypeName}</td>
              <td>{doc.departmentName}</td>
              <td>{doc.issuingOrganizationName}</td>
              <td>
                <DocumentStatusBadge status={doc.status} />
              </td>
              <td className="text-right">
                {canEditDraft(user, doc) && (
                  <div className="inline-flex items-center justify-end gap-1 align-middle">
                    <Button
                      variant="icon"
                      className={crudRowIconClassName}
                      aria-disabled={busy}
                      aria-label={`Edit ${doc.summary}`}
                      title="Edit draft"
                      onClick={() => !busy && onEdit(doc.id)}
                    >
                      <EditIcon />
                    </Button>
                    <Button
                      variant="icon"
                      className={`${crudRowIconClassName} row-action--danger`}
                      aria-disabled={busy}
                      aria-label={`Delete ${doc.summary}`}
                      title="Delete draft"
                      onClick={() => !busy && onDelete(doc.id)}
                    >
                      <DeleteIcon />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="text-center py-10 text-[#8e8e8e]">
                No documents match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
