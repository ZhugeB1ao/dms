import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '@/features/auth/context/useAuth.ts'
import { categoryApi } from '@/features/categories/api/categoryApi.ts'
import { departmentApi } from '@/features/departments/api/departmentApi.ts'
import {
  CrudPagination,
  CrudToolbar,
} from '@/shared/components/CrudPageLayout.tsx'
import Button from '@/shared/components/Button.tsx'
import Select from '@/shared/components/Select.tsx'
import { crudFilterClassName } from '@/shared/components/crudStyles.ts'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import {
  canEditDraft,
  canUseApprovalInbox,
} from '@/features/documents/permissions.ts'
import { documentWorkflowApi } from '@/features/documents/api/documentWorkflowApi.ts'
import {
  documentDirections,
  documentStatuses,
  type DocumentDetail,
  type DocumentDirection,
} from '@/features/documents/types.ts'
import DocumentsTable from '@/features/documents/components/DocumentsTable.tsx'
import DocumentFormDialog from '@/features/documents/components/DocumentFormDialog.tsx'
import DeleteDraftDialog from '@/features/documents/components/DeleteDraftDialog.tsx'

const loadFilterOptions = (signal: AbortSignal) =>
  Promise.all([
    categoryApi.listActive('DOC_TYPE', signal),
    departmentApi.listActive(signal),
  ]).then(([types, departments]) => ({ types, departments }))

export default function DocumentsPage({
  direction,
}: {
  direction: DocumentDirection
}) {
  const { user } = useAuth()
  return (
    <DocumentList
      key={`${direction}-${user?.id}-${user?.departmentId}-${user?.roles.join(',')}`}
      direction={direction}
    />
  )
}

function DocumentList({ direction }: { direction: DocumentDirection }) {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const positive = (value: string | null) =>
    value && Number.isSafeInteger(Number(value)) && Number(value) > 0
      ? Number(value)
      : undefined
  const page =
    Number.isSafeInteger(Number(params.get('page'))) &&
    Number(params.get('page')) >= 0
      ? Number(params.get('page'))
      : 0
  const size = [10, 20, 50].includes(Number(params.get('size')))
    ? (Number(params.get('size')) as 10 | 20 | 50)
    : 10
  const status = Object.hasOwn(documentStatuses, params.get('status') ?? '')
    ? params.get('status')!
    : undefined
  const documentTypeId = positive(params.get('documentTypeId'))
  const departmentId = positive(params.get('departmentId'))
  const normalized = new URLSearchParams({
    page: String(page),
    size: String(size),
  })
  if (status) normalized.set('status', status)
  if (documentTypeId) normalized.set('documentTypeId', String(documentTypeId))
  if (departmentId) normalized.set('departmentId', String(departmentId))
  const queryString = normalized.toString()
  const originalQuery = params.toString()
  const list = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        documentsApi.list(
          { direction, page, size, status, documentTypeId, departmentId },
          signal,
        ),
      [direction, page, size, status, documentTypeId, departmentId],
    ),
  )
  const options = useFetch(loadFilterOptions)
  const canReview = canUseApprovalInbox(user)
  const approvals = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        canReview
          ? documentWorkflowApi.pending({ page: 0, size: 10 }, signal)
          : Promise.resolve(null),
      [canReview],
    ),
  )
  const [modal, setModal] = useState<
    | { kind: 'edit' | 'delete'; document: DocumentDetail }
    | { kind: 'create' }
    | null
  >(null)
  const [actionError, setActionError] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const busy = busyKey === queryString
  const action = useRef<AbortController | null>(null)
  // Past the last page (e.g. after a delete) the URL is moved back to it.
  const lastPage = list.data ? Math.max(0, list.data.totalPages - 1) : page
  const targetQuery =
    page > lastPage
      ? new URLSearchParams({
          ...Object.fromEntries(normalized),
          page: String(lastPage),
        }).toString()
      : queryString
  const fresh = page > lastPage ? undefined : list.data
  // Keep the last loaded page mounted while refetching, so focus and layout survive.
  const [previous, setPrevious] = useState(fresh)
  if (fresh && fresh !== previous) setPrevious(fresh)
  const data = fresh ?? previous
  // navigate() instead of setParams(): setParams drops the #hash.
  const hash = location.hash
  useEffect(() => {
    if (originalQuery !== targetQuery)
      void navigate({ search: targetQuery, hash }, { replace: true })
  }, [originalQuery, targetQuery, hash, navigate])
  useEffect(() => () => action.current?.abort(), [queryString])
  function change(key: string, value: string) {
    const next = new URLSearchParams(queryString)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '0')
    setBusyKey(null)
    setActionError('')
    setParams(next)
  }
  function refresh() {
    setModal(null)
    setBusyKey(null)
    list.retry()
  }
  async function open(id: number, kind: 'edit' | 'delete') {
    action.current?.abort()
    const controller = new AbortController()
    action.current = controller
    setBusyKey(queryString)
    setActionError('')
    try {
      const document = await documentsApi.get(id, controller.signal)
      if (controller.signal.aborted) return
      if (canEditDraft(user, document)) setModal({ kind, document })
      else {
        setActionError('This document can no longer be edited or deleted.')
        list.retry()
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setActionError(documentError(error).message)
    } finally {
      if (action.current === controller) setBusyKey(null)
    }
  }
  return (
    <section className="p-6 sm:p-10 min-w-0">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="mt-3 text-3xl">
          {documentDirections[direction]} documents
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          {canReview && (
            <Link
              className="button button--secondary !rounded-full inline-flex items-center gap-2"
              to="/documents/pending-approvals"
            >
              Pending approvals
              {approvals.data && (
                <span className="rounded-full bg-sky-950 px-2 py-0.5 text-xs text-sky-200">
                  {approvals.data.pendingCount}
                </span>
              )}
            </Link>
          )}
          <Button
            className="!rounded-full px-5 py-2 font-medium"
            onClick={() => setModal({ kind: 'create' })}
          >
            + Create draft
          </Button>
        </div>
      </div>
      {canReview && approvals.error !== undefined && (
        <p role="status" className="mb-4 text-sm text-neutral-400">
          Pending count unavailable.{' '}
          <Button onClick={approvals.retry}>Retry count</Button>
        </p>
      )}
      <nav
        aria-label="Document directions"
        className="flex flex-wrap gap-5 mb-6"
      >
        {Object.entries(documentDirections).map(([key, label]) => (
          <Link
            key={key}
            to={`/documents/${key.toLowerCase()}`}
            aria-current={direction === key ? 'page' : undefined}
            className={`pb-2 border-b-2 ${direction === key ? 'border-emerald-400 text-white' : 'border-transparent text-neutral-400'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <CrudToolbar
        statusFilter={status ?? ''}
        onStatusFilterChange={(value) => change('status', value)}
        statusOptions={[
          { value: '', label: 'All statuses' },
          ...Object.entries(documentStatuses).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
        resultCount={data?.totalElements ?? 0}
        resultNoun={['document', 'documents']}
        extraFilters={
          <>
            <Select
              aria-label="Filter by type"
              className={crudFilterClassName}
              disabled={!options.data}
              value={documentTypeId ?? ''}
              onChange={(e) => change('documentTypeId', e.target.value)}
            >
              <option value="">All document types</option>
              {documentTypeId &&
                !options.data?.types.some(
                  (option) => option.id === documentTypeId,
                ) && (
                  <option value={documentTypeId}>
                    Unavailable type (#{documentTypeId})
                  </option>
                )}
              {options.data?.types.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by department"
              className={crudFilterClassName}
              disabled={!options.data}
              value={departmentId ?? ''}
              onChange={(e) => change('departmentId', e.target.value)}
            >
              <option value="">All departments</option>
              {departmentId &&
                !options.data?.departments.some(
                  (option) => option.id === departmentId,
                ) && (
                  <option value={departmentId}>
                    Unavailable department (#{departmentId})
                  </option>
                )}
              {options.data?.departments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </>
        }
      />
      {options.error !== undefined && (
        <p role="alert" className="mb-4">
          Unable to load filter options.{' '}
          <Button onClick={options.retry}>Retry filters</Button>
        </p>
      )}
      {actionError && (
        <p role="alert" className="mb-4 text-red-300">
          {actionError}
        </p>
      )}
      {busy && <p role="status">Loading document…</p>}
      {list.error !== undefined ? (
        <p role="alert">
          {documentError(list.error).message}{' '}
          <Button onClick={refresh}>Retry documents</Button>
        </p>
      ) : !data ? (
        <p role="status">Loading documents…</p>
      ) : (
        <>
          <DocumentsTable
            rows={data.content}
            user={user}
            busy={busy}
            onEdit={(id) => void open(id, 'edit')}
            onDelete={(id) => void open(id, 'delete')}
          />
          <CrudPagination
            page={page}
            totalPages={data.totalPages}
            size={size}
            onPageChange={(next) => change('page', String(next))}
            onSizeChange={(next) => change('size', String(next))}
          />
        </>
      )}
      {modal && modal.kind !== 'delete' && (
        <DocumentFormDialog
          document={modal.kind === 'edit' ? modal.document : null}
          direction={direction}
          onClose={() => setModal(null)}
          onSaved={refresh}
          onReloaded={list.retry}
          onGone={list.retry}
        />
      )}
      {modal?.kind === 'delete' && (
        <DeleteDraftDialog
          document={modal.document}
          onClose={() => setModal(null)}
          onDeleted={refresh}
          onConflict={refresh}
        />
      )}
    </section>
  )
}
