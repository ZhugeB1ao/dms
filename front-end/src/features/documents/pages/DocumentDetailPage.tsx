import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/features/auth/context/useAuth.ts'
import Button from '@/shared/components/Button.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { dossiersApi } from '@/features/dossiers/api/dossiersApi.ts'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import {
  canEditDraft,
  canUseApprovalInbox,
} from '@/features/documents/permissions.ts'
import { documentDirections } from '@/features/documents/types.ts'
import DocumentStatusBadge from '@/features/documents/components/DocumentStatusBadge.tsx'
import DocumentFormDialog from '@/features/documents/components/DocumentFormDialog.tsx'
import DeleteDraftDialog from '@/features/documents/components/DeleteDraftDialog.tsx'
import DocumentHistoryTab from '@/features/documents/components/DocumentHistoryTab.tsx'
import DocumentAttachmentsTab from '@/features/documents/components/DocumentAttachmentsTab.tsx'
import DocumentWorkflowActions from '@/features/documents/components/DocumentWorkflowActions.tsx'

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
function FetchedRecordLink({ dossierId }: { dossierId: number }) {
  const { data } = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        dossiersApi.get(dossierId, signal).catch(() => null),
      [dossierId],
    ),
  )
  return (
    <Link className="text-link" to={`/records/${dossierId}`}>
      {data
        ? `${data.code} — ${data.name}${data.closed ? ' (closed)' : ''}`
        : `Record #${dossierId}`}
    </Link>
  )
}

function DocumentDetailView({ id }: { id: number }) {
  const { user } = useAuth()
  const isStaff = Boolean(
    user && (user.roles.includes('MANAGER') || user.roles.includes('EMPLOYEE')),
  )
  const navigate = useNavigate()
  const location = useLocation()
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
  const [workflowLocked, setWorkflowLocked] = useState(false)
  const [workflowNotice, setWorkflowNotice] = useState('')
  const [workflowReadError, setWorkflowReadError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  function reload() {
    setModal(null)
    setWorkflowLocked(false)
    setWorkflowReadError('')
    setTabRevision((n) => n + 1)
    retry()
  }
  const focusHeading = useCallback(() => heading.current?.focus(), [])
  const pendingSearch: unknown = location.state?.pendingApprovalsSearch
  const fromInbox =
    canUseApprovalInbox(user) &&
    typeof pendingSearch === 'string' &&
    (pendingSearch === '' || pendingSearch.startsWith('?'))
  return (
    <section className="p-6 sm:p-10 min-w-0">
      <Link
        className="button button--secondary !rounded-full inline-flex"
        to={
          fromInbox
            ? {
                pathname: '/documents/pending-approvals',
                search: pendingSearch,
              }
            : doc
              ? `/documents/${doc.direction.toLowerCase()}`
              : '/documents/incoming'
        }
      >
        {fromInbox ? 'Back to pending approvals' : 'Back to documents'}
      </Link>
      {workflowNotice && (
        <p role="status" className="mt-4">
          {workflowNotice}
        </p>
      )}
      {workflowReadError ? (
        <p role="alert" className="mt-6">
          {workflowReadError} <Button onClick={reload}>Retry document</Button>
        </p>
      ) : loading ? (
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
                <h1
                  ref={heading}
                  tabIndex={-1}
                  className="text-3xl break-words mb-4"
                >
                  {doc.summary}
                </h1>
                <DocumentStatusBadge status={doc.status} />
              </div>
              <div className="flex flex-col items-start gap-3">
                {canEditDraft(user, doc) && !workflowLocked && (
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => setModal('edit')}>Edit draft</Button>
                    <Button onClick={() => setModal('delete')}>
                      Delete draft
                    </Button>
                  </div>
                )}
                <DocumentWorkflowActions
                  document={doc}
                  onDocumentChanged={(fresh) => {
                    setData(fresh)
                    setTabRevision((n) => n + 1)
                  }}
                  onLockedChange={setWorkflowLocked}
                  onNotice={setWorkflowNotice}
                  onUnavailable={setWorkflowReadError}
                  focusHeading={focusHeading}
                />
              </div>
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
                  {(
                    [
                      ['Document type', doc.lookups.documentType.name],
                      ['Urgency', doc.lookups.urgency.name],
                      ['Confidentiality', doc.lookups.confidentiality.name],
                      [
                        'Issuing organization',
                        doc.lookups.issuingOrganization.name,
                      ],
                      ['Responsible department', doc.lookups.department.name],
                      ...(doc.documentNumber
                        ? [
                            ['Document number', doc.documentNumber] satisfies [
                              string,
                              ReactNode,
                            ],
                          ]
                        : []),
                      ...(doc.reviewerName
                        ? [
                            ['Reviewer', doc.reviewerName] satisfies [
                              string,
                              ReactNode,
                            ],
                          ]
                        : []),
                      [
                        'Record',
                        !doc.dossierId ? (
                          'None'
                        ) : doc.dossier ? (
                          isStaff ? (
                            <Link
                              className="text-link"
                              to={`/records/${doc.dossierId}`}
                            >
                              {doc.dossier.code} — {doc.dossier.name}
                              {doc.dossier.closed ? ' (closed)' : ''}
                            </Link>
                          ) : (
                            `${doc.dossier.code} — ${doc.dossier.name}${doc.dossier.closed ? ' (closed)' : ''}`
                          )
                        ) : isStaff ? (
                          <FetchedRecordLink dossierId={doc.dossierId} />
                        ) : (
                          `Record #${doc.dossierId}`
                        ),
                      ],
                      ['Created by', `User ${doc.createdBy}`],
                      [
                        'Created',
                        new Date(doc.createdAt).toLocaleString('en-GB'),
                      ],
                      [
                        'Updated',
                        new Date(doc.updatedAt).toLocaleString('en-GB'),
                      ],
                    ] satisfies [string, ReactNode][]
                  ).map(([label, value]) => (
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
