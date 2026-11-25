import { useCallback, useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useAuth } from '@/features/auth/context/useAuth.ts'
import { categoryApi } from '@/features/categories/api/categoryApi.ts'
import { documentWorkflowApi } from '@/features/documents/api/documentWorkflowApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import {
  documentDirections,
  type DocumentDirection,
} from '@/features/documents/types.ts'
import Button from '@/shared/components/Button.tsx'
import { CrudPagination } from '@/shared/components/CrudPageLayout.tsx'
import { crudFilterClassName } from '@/shared/components/crudStyles.ts'
import Select from '@/shared/components/Select.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'

const loadTypes = (signal: AbortSignal) =>
  categoryApi.listActive('DOC_TYPE', signal)

export default function PendingApprovalsPage() {
  const { user } = useAuth()
  return <PendingApprovalsList key={`${user?.id}-${user?.departmentId}`} />
}

function PendingApprovalsList() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const directionParam = params.get('direction')
  const direction =
    directionParam && Object.hasOwn(documentDirections, directionParam)
      ? (directionParam as DocumentDirection)
      : undefined
  const type = Number(params.get('documentTypeId'))
  const documentTypeId =
    Number.isSafeInteger(type) && type > 0 ? type : undefined
  const pageParam = Number(params.get('page'))
  const page = Number.isSafeInteger(pageParam) && pageParam >= 0 ? pageParam : 0
  const sizeParam = Number(params.get('size'))
  const size = sizeParam === 20 || sizeParam === 50 ? sizeParam : 10
  const { data, loading, error, retry } = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        documentWorkflowApi.pending(
          { page, size, direction, documentTypeId },
          signal,
        ),
      [page, size, direction, documentTypeId],
    ),
  )
  const types = useFetch(loadTypes)
  const lastPage = data ? Math.max(0, data.totalPages - 1) : page

  useEffect(() => {
    if (page > lastPage) {
      const next = new URLSearchParams(params)
      next.set('page', String(lastPage))
      setParams(next, { replace: true })
    }
  }, [page, lastPage, params, setParams])

  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '0')
    setParams(next)
  }

  return (
    <section className="min-w-0 p-6 sm:p-10">
      <Link
        className="button button--secondary !rounded-full inline-flex"
        to="/documents"
      >
        Back to documents
      </Link>
      <div className="my-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">Pending approvals</h1>
        {data && (
          <span className="rounded-full bg-sky-950 px-2.5 py-1 text-xs text-sky-200">
            {data.pendingCount} pending
          </span>
        )}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select
          aria-label="Filter by type"
          className={crudFilterClassName}
          value={documentTypeId ?? ''}
          onChange={(event) =>
            change('documentTypeId', event.currentTarget.value)
          }
          disabled={types.loading || types.error !== undefined}
        >
          <option value="">All document types</option>
          {documentTypeId &&
            !types.data?.some((item) => item.id === documentTypeId) && (
              <option value={documentTypeId}>
                Document type {documentTypeId}
              </option>
            )}
          {types.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by direction"
          className={crudFilterClassName}
          value={direction ?? ''}
          onChange={(event) => change('direction', event.currentTarget.value)}
        >
          <option value="">All directions</option>
          {Object.entries(documentDirections).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {data && (
          <p role="status" className="text-sm text-neutral-400">
            {data.totalElements}{' '}
            {data.totalElements === 1 ? 'document' : 'documents'}
          </p>
        )}
      </div>
      {types.error !== undefined && (
        <p role="alert">
          Unable to load document types.{' '}
          <Button onClick={types.retry}>Retry types</Button>
        </p>
      )}
      {error !== undefined && (
        <p role="alert">
          {documentError(error).message}{' '}
          <Button onClick={retry}>Retry approvals</Button>
        </p>
      )}
      {(loading || page > lastPage) && (
        <p role="status">Loading pending approvals…</p>
      )}
      {data && page <= lastPage && (
        <>
          {data.content.length ? (
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table
                className="data-table min-w-[640px]"
                aria-label="Pending approvals"
              >
                <thead>
                  <tr>
                    <th scope="col">Summary</th>
                    <th scope="col">Submitted by</th>
                    <th scope="col">Department</th>
                    <th scope="col">Submitted</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.content.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.summary}</td>
                      <td>{doc.submittedByName}</td>
                      <td>{doc.departmentName}</td>
                      <td>
                        <time dateTime={doc.submittedAt}>
                          {new Date(doc.submittedAt).toLocaleString('en-GB')}
                        </time>
                      </td>
                      <td>
                        <Link
                          className="button button--secondary !rounded-full inline-flex"
                          to={`/documents/${doc.id}`}
                          state={{ pendingApprovalsSearch: location.search }}
                          aria-label={`Review ${doc.summary}`}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              {direction || documentTypeId
                ? 'No pending approvals match your filters.'
                : 'No pending approvals.'}
            </p>
          )}
          <CrudPagination
            page={page}
            size={size}
            totalPages={data.totalPages}
            onPageChange={(next) => change('page', String(next))}
            onSizeChange={(next) => change('size', String(next))}
          />
        </>
      )}
    </section>
  )
}
