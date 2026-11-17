import Select from '@/shared/components/Select.tsx'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import Button from '@/shared/components/Button.tsx'
import { useAuth } from '@/features/auth/context/useAuth.ts'
import {
  departmentApi,
  type DepartmentItem,
} from '@/features/departments/api/departmentApi.ts'
import { usersApi } from '@/features/users/api/usersApi.ts'
import { userError } from '@/features/users/api/userErrors.ts'
import type {
  AccountQuery,
  AccountPageResult,
  ManagedAccount,
  UserAction,
} from '@/features/users/types.ts'
import UserFormDialog from '@/features/users/components/UserFormDialog.tsx'
import UserActionDialog from '@/features/users/components/UserActionDialog.tsx'
import {
  CrudHeader,
  CrudPagination,
  CrudRowActions,
  CrudToolbar,
} from '@/shared/components/CrudPageLayout.tsx'
import {
  crudFilterClassName,
  crudRowIconClassName,
} from '@/shared/components/crudStyles.ts'
import { KeyIcon } from '@/shared/components/Icons.tsx'

const initialQuery: AccountQuery = { page: 0, size: 10 }
const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'true', label: 'Active only' },
  { value: 'false', label: 'Inactive only' },
]
export default function UsersPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState<AccountQuery>(initialQuery)
  const [result, setResult] = useState<AccountPageResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [optionsAttempt, setOptionsAttempt] = useState(0)
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [optionsError, setOptionsError] = useState('')
  const [dialog, setDialog] = useState<
    | { action: 'view'; account: ManagedAccount }
    | { action: 'edit'; account: ManagedAccount | null }
    | { action: UserAction; account: ManagedAccount }
    | null
  >(null)
  const [searchText, setSearchText] = useState('')
  const generation = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      const keyword = searchText.trim().slice(0, 254) || undefined
      setQuery((previous) =>
        previous.keyword === keyword
          ? previous
          : { ...previous, keyword, page: 0 },
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText])

  useEffect(() => {
    const controller = new AbortController()
    departmentApi
      .listTree(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setDepartments(items)
          setOptionsError('')
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setOptionsError(userError(failure).message)
      })
    return () => controller.abort()
  }, [optionsAttempt])
  useEffect(() => {
    const controller = new AbortController()
    const current = ++generation.current
    setLoading(true)
    setError('')
    usersApi
      .list(query, controller.signal)
      .then((data) => {
        if (controller.signal.aborted || current !== generation.current) return
        const lastPage = Math.max(0, data.totalPages - 1)
        if (query.page > lastPage) {
          setQuery((previous) => ({ ...previous, page: lastPage }))
          return
        }
        setResult(data)
        setLoading(false)
      })
      .catch((failure) => {
        if (controller.signal.aborted || current !== generation.current) return
        setError(userError(failure).message)
        setLoading(false)
      })
    return () => controller.abort()
  }, [query, revision])
  function filter(values: Partial<AccountQuery>) {
    setQuery((previous) => ({ ...previous, ...values, page: 0 }))
  }
  function refreshed(message: string) {
    setNotice(message)
    setDialog(null)
    setRevision((n) => n + 1)
  }

  return (
    <section className="p-6 sm:p-10">
      <CrudHeader
        title="Account management"
        createLabel="+ Create account"
        onCreate={() => setDialog({ action: 'edit', account: null })}
      />
      <CrudToolbar
        search={searchText}
        onSearchChange={setSearchText}
        searchAriaLabel="Search accounts"
        statusFilter={query.active === undefined ? '' : String(query.active)}
        onStatusFilterChange={(value) =>
          filter({ active: value ? value === 'true' : undefined })
        }
        statusOptions={statusOptions}
        resultCount={result?.totalElements ?? 0}
        resultNoun={['account', 'accounts']}
        extraFilters={
          <>
            <Select
              value={query.departmentId ?? ''}
              onChange={(e) =>
                filter({
                  departmentId: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              aria-label="Filter by department"
              className={crudFilterClassName}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code}){!d.isActive ? ' (inactive)' : ''}
                </option>
              ))}
            </Select>
            <Select
              value={query.role ?? ''}
              onChange={(e) =>
                filter({
                  role: (e.target.value || undefined) as AccountQuery['role'],
                })
              }
              aria-label="Filter by role"
              className={crudFilterClassName}
            >
              <option value="">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="EMPLOYEE">Employee</option>
            </Select>
          </>
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setSearchText('')
              setQuery(initialQuery)
            }}
            className="!min-h-[38px] !py-1.5 !text-sm"
          >
            Clear filters
          </Button>
        }
      />
      {optionsError && (
        <div className="management-notice" role="alert">
          {optionsError}{' '}
          <Button
            variant="secondary"
            onClick={() => setOptionsAttempt((n) => n + 1)}
          >
            Reload options
          </Button>
        </div>
      )}
      {notice && (
        <p className="management-notice" role="status">
          {notice}
        </p>
      )}
      {error ? (
        <div className="management-notice" role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={() => setRevision((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : (
        <div aria-busy={loading}>
          <div className="overflow-x-auto rounded-xl border border-[#292929]/80 bg-[#121212]/30">
            <table className="data-table" aria-label="Accounts table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Department</th>
                  <th scope="col">Position</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-10 text-[#8e8e8e]"
                    >
                      Loading accounts…
                    </td>
                  </tr>
                ) : !result?.content.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-10 text-[#8e8e8e]"
                    >
                      {query.role ||
                      query.active !== undefined ||
                      query.keyword ||
                      query.departmentId
                        ? 'No accounts match your filters.'
                        : 'No accounts yet.'}
                    </td>
                  </tr>
                ) : (
                  result.content.map((account) => {
                    const self = String(account.id) === user?.id
                    return (
                      <tr
                        key={account.id}
                        className={`cursor-pointer transition-colors hover:bg-[#1e1e1e]/40 ${
                          !account.active ? 'row-inactive' : ''
                        }`}
                        onClick={(e) => {
                          // Row buttons and links keep their own action.
                          if (!(e.target as HTMLElement).closest('button, a'))
                            setDialog({ action: 'view', account })
                        }}
                      >
                        <td>
                          <button
                            type="button"
                            className="font-medium text-[#f5f5f5] underline-offset-4 hover:underline"
                            aria-label={`View details ${account.username}`}
                            onClick={() =>
                              setDialog({ action: 'view', account })
                            }
                          >
                            {account.username}
                          </button>
                          <span className="block text-xs text-[#a3a3a3] break-all">
                            {account.email}
                          </span>
                          {self && (
                            <span className="block text-xs text-[#8e8e8e]">
                              Your account
                            </span>
                          )}
                        </td>
                        <td>
                          {departments.find(
                            (d) => d.id === account.departmentId,
                          )?.name ??
                            account.departmentId ??
                            'Not assigned'}
                        </td>
                        <td>{account.position ?? 'Not assigned'}</td>
                        <td className="text-xs">{account.role}</td>
                        <td>{account.active ? 'Active' : 'Inactive'}</td>
                        <td className="text-right">
                          <CrudRowActions
                            itemName={account.username}
                            isActive={account.active}
                            onEdit={() =>
                              setDialog({ action: 'edit', account })
                            }
                            onDeactivate={() =>
                              setDialog({ action: 'deactivate', account })
                            }
                            onReactivate={() =>
                              setDialog({ action: 'activate', account })
                            }
                            statusDisabledReason={
                              self
                                ? 'You cannot deactivate your own account'
                                : undefined
                            }
                          >
                            {self ? (
                              <Link
                                to="/change-password"
                                aria-label="Change my password"
                                title="Change my password"
                                className={`button button--icon ${crudRowIconClassName}`}
                              >
                                <KeyIcon />
                              </Link>
                            ) : (
                              <Button
                                variant="icon"
                                aria-label={`Reset password ${account.username}`}
                                title={`Reset password ${account.username}`}
                                onClick={() =>
                                  setDialog({
                                    action: 'resetPassword',
                                    account,
                                  })
                                }
                                className={crudRowIconClassName}
                              >
                                <KeyIcon />
                              </Button>
                            )}
                          </CrudRowActions>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <CrudPagination
            page={query.page}
            totalPages={result?.totalPages ?? 1}
            size={query.size}
            disabled={loading}
            onPageChange={(page) =>
              setQuery((previous) => ({ ...previous, page }))
            }
            onSizeChange={(size) =>
              filter({ size: size as AccountQuery['size'] })
            }
          />
        </div>
      )}
      {dialog?.action === 'edit' && (
        <UserFormDialog
          account={dialog.account}
          onClose={() => setDialog(null)}
          onSaved={(_, warning) =>
            refreshed(warning ?? 'Account saved successfully.')
          }
        />
      )}
      {dialog?.action === 'view' && (
        <UserFormDialog
          account={dialog.account}
          readOnly
          onClose={() => setDialog(null)}
        />
      )}
      {dialog && dialog.action !== 'edit' && dialog.action !== 'view' && (
        <UserActionDialog
          account={dialog.account}
          action={dialog.action}
          onClose={() => setDialog(null)}
          onDone={() => refreshed('Action completed successfully.')}
          onConflict={() => setRevision((n) => n + 1)}
        />
      )}
    </section>
  )
}
