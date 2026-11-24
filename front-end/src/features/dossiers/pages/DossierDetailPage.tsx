import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/features/auth/context/useAuth.ts'
import Button from '@/shared/components/Button.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { documentDirections } from '@/features/documents/types.ts'
import DocumentStatusBadge from '@/features/documents/components/DocumentStatusBadge.tsx'
import { dossiersApi } from '@/features/dossiers/api/dossiersApi.ts'
import { dossierError } from '@/features/dossiers/api/dossierErrors.ts'
import DossierStatusBadge from '@/features/dossiers/components/DossierStatusBadge.tsx'
import DossierFormDialog from '@/features/dossiers/components/DossierFormDialog.tsx'
import CloseDossierDialog from '@/features/dossiers/components/CloseDossierDialog.tsx'
import AttachDocumentDialog from '@/features/dossiers/components/AttachDocumentDialog.tsx'

export default function DossierDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0)
    return (
      <section className="p-10">
        <p role="alert">This record no longer exists.</p>
      </section>
    )
  return (
    <DossierDetailView
      key={`${id}-${user?.id}-${user?.departmentId}-${user?.roles.join(',')}`}
      id={Number(id)}
    />
  )
}

function DossierDetailView({ id }: { id: number }) {
  const {
    data: loaded,
    error,
    loading,
    retry,
    setData,
  } = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        Promise.all([
          dossiersApi.get(id, signal),
          dossiersApi.listDocuments(id, signal),
        ]).then(([dossier, documents]) => ({ dossier, documents })),
      [id],
    ),
  )

  const [previous, setPrevious] = useState(loaded)
  if (loaded && loaded !== previous) setPrevious(loaded)
  const data = loaded ?? previous

  const [modal, setModal] = useState<'edit' | 'close' | 'attach' | null>(null)
  const [detachError, setDetachError] = useState('')
  const [detachingId, setDetachingId] = useState<number | null>(null)
  const detachPending = useRef<AbortController | null>(null)

  useEffect(() => () => detachPending.current?.abort(), [])

  function reload() {
    setModal(null)
    setDetachError('')
    retry()
  }

  async function detach(documentId: number) {
    if (detachPending.current) return
    const controller = new AbortController()
    detachPending.current = controller
    setDetachingId(documentId)
    setDetachError('')
    try {
      await dossiersApi.detachDocument(id, documentId, controller.signal)
      if (!controller.signal.aborted) reload()
    } catch (caught) {
      if (!controller.signal.aborted)
        setDetachError(dossierError(caught).message)
    } finally {
      if (!controller.signal.aborted) {
        detachPending.current = null
        setDetachingId(null)
      }
    }
  }

  const dossier = data?.dossier
  const documents = data?.documents

  return (
    <section className="p-6 sm:p-10 min-w-0">
      <Link className="text-link" to="/records">
        Back to records
      </Link>

      {error !== undefined ? (
        <p role="alert" className="mt-6">
          {dossierError(error).message}{' '}
          <Button onClick={reload}>Retry record</Button>
        </p>
      ) : loading && !data ? (
        <p role="status" className="mt-6">
          Loading record…
        </p>
      ) : (
        dossier &&
        documents && (
          <>
            <div className="flex flex-col sm:flex-row items-start justify-between gap-5 my-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-400 font-mono mb-2">
                  {dossier.code} · {dossier.year}
                </p>
                <h1 className="text-3xl break-words mb-4">{dossier.name}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-400">
                  <DossierStatusBadge closed={dossier.closed} />
                  <span>
                    {dossier.documentCount}{' '}
                    {dossier.documentCount === 1 ? 'document' : 'documents'}
                  </span>
                  <span>
                    Created{' '}
                    {new Date(dossier.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>
              {!dossier.closed && (
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setModal('edit')}>
                    Edit record
                  </Button>
                  <Button variant="secondary" onClick={() => setModal('close')}>
                    Close record
                  </Button>
                </div>
              )}
            </div>

            {dossier.closed && (
              <p
                role="status"
                className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-300"
              >
                This record is closed and read-only. Details and attached
                documents can no longer be changed.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-medium">Documents</h2>
              {!dossier.closed && (
                <Button onClick={() => setModal('attach')}>
                  Attach document
                </Button>
              )}
            </div>

            {detachError && (
              <p role="alert" className="mb-4 text-sm text-red-300">
                {detachError}
              </p>
            )}

            <div
              role="region"
              aria-label="Record documents table"
              tabIndex={0}
              className="overflow-x-auto rounded-xl border border-[#292929]/80 bg-[#121212]/30"
            >
              <table
                className="data-table min-w-[680px]"
                aria-label="Record documents"
              >
                <thead>
                  <tr>
                    <th scope="col">Summary</th>
                    <th scope="col">Direction</th>
                    <th scope="col">Document type</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <Link
                          className="text-link inline-block min-w-40 max-w-sm break-words"
                          to={`/documents/${doc.id}`}
                        >
                          {doc.summary}
                        </Link>
                      </td>
                      <td>
                        {documentDirections[doc.direction] ?? doc.direction}
                      </td>
                      <td>{doc.documentTypeName ?? '—'}</td>
                      <td>
                        <DocumentStatusBadge status={doc.status} />
                      </td>
                      <td className="text-right">
                        {!dossier.closed && (
                          <Button
                            variant="secondary"
                            disabled={detachingId === doc.id}
                            aria-label={`Detach ${doc.summary}`}
                            onClick={() => void detach(doc.id)}
                            className="!min-h-[34px] !px-3 !py-1 !text-xs"
                          >
                            Detach
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!documents.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-10 text-[#8e8e8e]"
                      >
                        No documents attached to this record.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {modal === 'edit' && (
              <DossierFormDialog
                dossier={dossier}
                onClose={() => setModal(null)}
                onSaved={(updated) => {
                  setModal(null)
                  setData({ dossier: updated, documents })
                }}
              />
            )}
            {modal === 'close' && (
              <CloseDossierDialog
                dossier={dossier}
                onClose={() => setModal(null)}
                onClosed={(closed) => {
                  setModal(null)
                  setData({ dossier: closed, documents })
                }}
              />
            )}
            {modal === 'attach' && (
              <AttachDocumentDialog
                dossierId={id}
                onClose={() => setModal(null)}
                onAttached={reload}
              />
            )}
          </>
        )
      )}
    </section>
  )
}
