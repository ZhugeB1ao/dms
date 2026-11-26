import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '@/features/auth/context/useAuth.ts'
import {
  CrudHeader,
  CrudPagination,
  CrudToolbar,
} from '@/shared/components/CrudPageLayout.tsx'
import Button from '@/shared/components/Button.tsx'
import Select from '@/shared/components/Select.tsx'
import { DeactivateIcon, EditIcon } from '@/shared/components/Icons.tsx'
import {
  crudFilterClassName,
  crudRowIconClassName,
} from '@/shared/components/crudStyles.ts'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { dossiersApi } from '@/features/dossiers/api/dossiersApi.ts'
import { dossierError } from '@/features/dossiers/api/dossierErrors.ts'
import type { Dossier } from '@/features/dossiers/types.ts'
import DossierStatusBadge from '@/features/dossiers/components/DossierStatusBadge.tsx'
import DossierFormDialog from '@/features/dossiers/components/DossierFormDialog.tsx'
import CloseDossierDialog from '@/features/dossiers/components/CloseDossierDialog.tsx'

export default function DossiersPage() {
  const { user } = useAuth()
  return (
    <DossierList
      key={`${user?.id}-${user?.departmentId}-${user?.roles.join(',')}`}
    />
  )
}

function parseYear(raw: string | null): number | undefined {
  if (!raw || !/^\d{4}$/.test(raw)) return undefined
  const num = Number(raw)
  return num >= 1900 && num <= 2100 ? num : undefined
}

function DossierList() {
  const [params, setParams] = useSearchParams()
  const page =
    Number.isSafeInteger(Number(params.get('page'))) &&
    Number(params.get('page')) >= 0
      ? Number(params.get('page'))
      : 0
  const size = [10, 20, 50].includes(Number(params.get('size')))
    ? (Number(params.get('size')) as 10 | 20 | 50)
    : 10
  const year = parseYear(params.get('year'))
  const rawClosed = params.get('closed')
  const closed =
    rawClosed === 'true' ? true : rawClosed === 'false' ? false : undefined

  const normalized = new URLSearchParams({
    page: String(page),
    size: String(size),
  })
  if (year !== undefined) normalized.set('year', String(year))
  if (closed !== undefined) normalized.set('closed', String(closed))
  const queryString = normalized.toString()
  const originalQuery = params.toString()

  const list = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        dossiersApi.list({ year, closed, page, size }, signal),
      [year, closed, page, size],
    ),
  )

  const [modal, setModal] = useState<
    { kind: 'create' } | { kind: 'edit' | 'close'; dossier: Dossier } | null
  >(null)

  const lastPage = list.data ? Math.max(0, list.data.totalPages - 1) : page
  const targetQuery =
    page > lastPage
      ? new URLSearchParams({
          ...Object.fromEntries(normalized),
          page: String(lastPage),
        }).toString()
      : queryString
  const fresh = page > lastPage ? undefined : list.data
  const [previous, setPrevious] = useState(fresh)
  if (fresh && fresh !== previous) setPrevious(fresh)
  const data = fresh ?? previous

  useEffect(() => {
    if (originalQuery !== targetQuery) setParams(targetQuery, { replace: true })
  }, [originalQuery, targetQuery, setParams])

  function change(key: string, value: string) {
    const next = new URLSearchParams(queryString)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '0')
    setParams(next)
  }

  function refresh() {
    setModal(null)
    list.retry()
  }

  const currentYear = new Date().getFullYear()
  const baseYears = Array.from({ length: 6 }, (_, i) => currentYear + 1 - i)
  const yearOptions =
    year !== undefined && !baseYears.includes(year)
      ? [year, ...baseYears].sort((a, b) => b - a)
      : baseYears

  return (
    <section className="p-6 sm:p-10 min-w-0">
      <CrudHeader
        title="Records"
        createLabel="+ New record"
        onCreate={() => setModal({ kind: 'create' })}
      />

      <search role="search" aria-label="Filter records">
        <CrudToolbar
          statusFilter={closed === undefined ? '' : String(closed)}
          onStatusFilterChange={(value) => change('closed', value)}
          statusOptions={[
            { value: '', label: 'All statuses' },
            { value: 'false', label: 'Open' },
            { value: 'true', label: 'Closed' },
          ]}
          resultCount={data?.totalElements ?? 0}
          resultNoun={['record', 'records']}
          extraFilters={
            <Select
              aria-label="Filter by year"
              className={crudFilterClassName}
              value={year ?? ''}
              onChange={(e) => change('year', e.target.value)}
            >
              <option value="">All years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          }
          actions={
            <Button
              variant="secondary"
              onClick={() =>
                setParams(
                  new URLSearchParams({ page: '0', size: String(size) }),
                )
              }
              className="!min-h-[38px] !py-1.5 !text-sm"
            >
              Clear filters
            </Button>
          }
        />
      </search>

      {list.error !== undefined ? (
        <p role="alert">
          {dossierError(list.error).message}{' '}
          <Button onClick={refresh}>Retry records</Button>
        </p>
      ) : !data ? (
        <p role="status">Loading records…</p>
      ) : (
        <>
          <div
            role="region"
            aria-label="Records table"
            tabIndex={0}
            className="overflow-x-auto rounded-xl border border-[#292929]/80 bg-[#121212]/30"
          >
            <table className="data-table min-w-[760px]" aria-label="Records">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Year</th>
                  <th scope="col">Documents</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((dossier) => (
                  <tr
                    key={dossier.id}
                    className={dossier.closed ? 'row-inactive' : undefined}
                  >
                    <td className="font-mono text-xs whitespace-nowrap">
                      <Link className="text-link" to={`/records/${dossier.id}`}>
                        {dossier.code}
                      </Link>
                    </td>
                    <td>
                      <Link
                        className="text-link inline-block min-w-40 max-w-sm break-words"
                        to={`/records/${dossier.id}`}
                      >
                        {dossier.name}
                      </Link>
                    </td>
                    <td>{dossier.year}</td>
                    <td>{dossier.documentCount}</td>
                    <td>
                      <DossierStatusBadge closed={dossier.closed} />
                    </td>
                    <td className="text-right">
                      {!dossier.closed && (
                        <div className="inline-flex items-center justify-end gap-1 align-middle">
                          <Button
                            variant="icon"
                            className={crudRowIconClassName}
                            aria-label={`Edit ${dossier.code}`}
                            title="Edit record"
                            onClick={() => setModal({ kind: 'edit', dossier })}
                          >
                            <EditIcon />
                          </Button>
                          <Button
                            variant="icon"
                            className={`${crudRowIconClassName} row-action--danger`}
                            aria-label={`Close ${dossier.code}`}
                            title="Close record"
                            onClick={() => setModal({ kind: 'close', dossier })}
                          >
                            <DeactivateIcon />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!data.content.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-10 text-[#8e8e8e]"
                    >
                      {year !== undefined || closed !== undefined
                        ? 'No records match these filters.'
                        : 'No records yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <CrudPagination
            page={page}
            totalPages={data.totalPages}
            size={size}
            onPageChange={(next) => change('page', String(next))}
            onSizeChange={(next) => change('size', String(next))}
          />
        </>
      )}

      {modal && modal.kind !== 'close' && (
        <DossierFormDialog
          dossier={modal.kind === 'edit' ? modal.dossier : null}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
      {modal?.kind === 'close' && (
        <CloseDossierDialog
          dossier={modal.dossier}
          onClose={() => setModal(null)}
          onClosed={refresh}
        />
      )}
    </section>
  )
}
