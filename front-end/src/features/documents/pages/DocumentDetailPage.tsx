import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/features/auth/context/useAuth.ts'
import Button from '@/shared/components/Button.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import { canEditDraft } from '@/features/documents/permissions.ts'
import { documentDirections } from '@/features/documents/types.ts'
import DocumentStatusBadge from '@/features/documents/components/DocumentStatusBadge.tsx'
import DocumentFormDialog from '@/features/documents/components/DocumentFormDialog.tsx'
import DeleteDraftDialog from '@/features/documents/components/DeleteDraftDialog.tsx'
import DocumentHistoryTab from '@/features/documents/components/DocumentHistoryTab.tsx'
import DocumentAttachmentsTab from '@/features/documents/components/DocumentAttachmentsTab.tsx'

export default function DocumentDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0)
    return (
      <section className="p-10">
        <p role="alert">This document no longer exists.</p>
      </section>
    )
  return (
    <DocumentDetailView
      key={`${id}-${user?.id}-${user?.departmentId}-${user?.roles.join(',')}`}
      id={Number(id)}
    />
  )
}
function DocumentDetailView({ id }: { id: number }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    data: doc,
    error,
    loading,
    retry,
    setData,
  } = useFetch(
    useCallback((signal: AbortSignal) => documentsApi.get(id, signal), [id]),
  )
  // Bumped after a save so the tabs reload attachments and history.
  const [tabRevision, setTabRevision] = useState(0)
  const [tab, setTab] = useState(0)
  const [modal, setModal] = useState<'edit' | 'delete' | null>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  function reload() {
    setModal(null)
    retry()
  }
  return (
    <section className="p-6 sm:p-10 min-w-0">
      <Link
        className="text-link"
        to={
          doc
            ? `/documents/${doc.direction.toLowerCase()}`
            : '/documents/incoming'
        }
      >
        Back to documents
      </Link>
      {loading ? (
        <p role="status" className="mt-6">
          Loading document…
        </p>
      ) : error ? (
        <p role="alert" className="mt-6">
          {documentError(error).message}{' '}
          <Button onClick={reload}>Retry document</Button>
        </p>
      ) : (
        doc && (
          <>
            <div className="flex flex-col sm:flex-row items-start justify-between gap-5 my-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-400 mb-2">
                  {documentDirections[doc.direction]} correspondence
                </p>
                <h1 className="text-3xl break-words mb-4">{doc.summary}</h1>
                <DocumentStatusBadge status={doc.status} />
              </div>
              {canEditDraft(user, doc) && (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setModal('edit')}>Edit draft</Button>
                  <Button onClick={() => setModal('delete')}>
                    Delete draft
                  </Button>
                </div>
              )}
            </div>
            <div
              role="tablist"
              aria-label="Document details"
              className="flex flex-wrap gap-5 mb-6 border-b border-neutral-800"
            >
              {['Information', 'Attachments', 'Status history'].map(
                (label, index) => (
                  <button
                    type="button"
                    key={label}
                    ref={(element) => {
                      tabs.current[index] = element
                    }}
                    role="tab"
                    id={`document-tab-${index}`}
                    aria-controls="document-panel"
                    aria-selected={tab === index}
                    tabIndex={tab === index ? 0 : -1}
                    className={`py-3 border-b-2 ${tab === index ? 'border-emerald-400 text-white' : 'border-transparent text-neutral-400'}`}
                    onClick={() => setTab(index)}
                    onKeyDown={(event) => {
                      const next =
                        event.key === 'ArrowRight'
                          ? (index + 1) % 3
                          : event.key === 'ArrowLeft'
                            ? (index + 2) % 3
                            : event.key === 'Home'
                              ? 0
                              : event.key === 'End'
                                ? 2
                                : undefined
                      if (next !== undefined) {
                        event.preventDefault()
                        setTab(next)
                        tabs.current[next]?.focus()
                      }
                    }}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
            <div
              role="tabpanel"
              id="document-panel"
              aria-labelledby={`document-tab-${tab}`}
              tabIndex={0}
            >
              {tab === 0 && (
                <dl className="grid sm:grid-cols-2 gap-6 rounded-xl border border-neutral-800 p-6">
                  {Object.entries({
                    'Document type': doc.lookups.documentType.name,
                    Urgency: doc.lookups.urgency.name,
                    Confidentiality: doc.lookups.confidentiality.name,
                    'Issuing organization':
                      doc.lookups.issuingOrganization.name,
                    'Responsible department': doc.lookups.department.name,
                    'Created by': `User ${doc.createdBy}`,
                    Created: new Date(doc.createdAt).toLocaleString('en-GB'),
                    Updated: new Date(doc.updatedAt).toLocaleString('en-GB'),
                  }).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-sm text-neutral-400 mb-1">{label}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {tab === 1 && (
                <DocumentAttachmentsTab
                  key={`${id}-${tabRevision}`}
                  documentId={id}
                  canManage={canEditDraft(user, doc)}
                />
              )}
              {tab === 2 && (
                <DocumentHistoryTab
                  key={`${id}-${tabRevision}`}
                  documentId={id}
                />
              )}
            </div>
            {modal === 'edit' && (
              <DocumentFormDialog
                document={doc}
                direction={doc.direction}
                onClose={() => setModal(null)}
                onReloaded={setData}
                onSaved={(document) => {
                  setModal(null)
                  setData(document)
                  setTabRevision((n) => n + 1)
                }}
              />
            )}
            {modal === 'delete' && (
              <DeleteDraftDialog
                document={doc}
                onClose={() => setModal(null)}
                onDeleted={() =>
                  navigate(`/documents/${doc.direction.toLowerCase()}`)
                }
                onConflict={reload}
              />
            )}
          </>
        )
      )}
    </section>
  )
}
