import Select from '../../../shared/components/Select.tsx'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import Button from '../../../shared/components/Button.tsx'
import { useAuth } from '../../auth/context/useAuth.ts'
import {
  departmentApi,
  type DepartmentItem,
} from '../../departments/api/departmentApi.ts'
import { usersApi } from '../api/usersApi.ts'
import { userError } from '../api/userErrors.ts'
import type {
  AccountQuery,
  AccountPageResult,
  ManagedAccount,
  UserAction,
} from '../types.ts'
import UserFormDialog from '../components/UserFormDialog.tsx'
import UserActionDialog from '../components/UserActionDialog.tsx'

const initialQuery: AccountQuery = { page: 0, size: 10 }
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
    | { action: 'edit'; account: ManagedAccount | null }
    | { action: UserAction; account: ManagedAccount }
    | null
  >(null)
  const generation = useRef(0)

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
  const pages = Math.max(1, result?.totalPages ?? 1)

  return (
    <section className="management-page" aria-labelledby="users-heading">
      <div className="management-heading">
        <div>
          <p className="management-eyebrow">SYSTEM ADMINISTRATION</p>
          <h1 id="users-heading">Account management</h1>
          <p className="text-muted">
            Manage account details, access permissions and status.
          </p>
        </div>
        <Button onClick={() => setDialog({ action: 'edit', account: null })}>
          Create account
        </Button>
      </div>
      <div className="management-filters">
        <div className="user-field">
          <label htmlFor="filter-department">Filter by department</label>
          <Select
            id="filter-department"
            value={query.departmentId ?? ''}
            onChange={(e) =>
              filter({
                departmentId: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code}){!d.isActive ? ' (inactive)' : ''}
              </option>
            ))}
          </Select>
        </div>
        <div className="user-field">
          <label htmlFor="filter-role">Filter by role</label>
          <Select
            id="filter-role"
            value={query.role ?? ''}
            onChange={(e) =>
              filter({
                role: (e.target.value || undefined) as AccountQuery['role'],
              })
            }
          >
            <option value="">All roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="EMPLOYEE">Employee</option>
          </Select>
        </div>
        <div className="user-field">
          <label htmlFor="filter-status">Filter by status</label>
          <Select
            id="filter-status"
            value={query.active === undefined ? '' : String(query.active)}
            onChange={(e) =>
              filter({
                active: e.target.value ? e.target.value === 'true' : undefined,
              })
            }
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setQuery(initialQuery)
          }}
        >
          Clear filters
        </Button>
      </div>
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
          {loading ? (
            <p role="status" className="management-empty">
              Loading accounts…
            </p>
          ) : (
            <>
              <p className="management-count" role="status">
                {result?.totalElements ?? 0}{' '}
                {result?.totalElements === 1 ? 'account' : 'accounts'}
              </p>
              {result?.content.length ? (
                <div
                  className="management-table-scroll"
                  role="region"
                  aria-label="Accounts table"
                  tabIndex={0}
                >
                  <table className="management-table">
                    <caption className="sr-only">Account list</caption>
                    <thead>
                      <tr>
                        {[
                          'Account',
                          'Department',
                          'Position',
                          'Role',
                          'Status',
                          'Actions',
                        ].map((name) => (
                          <th key={name} scope="col">
                            {name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.content.map((account) => {
                        const self = String(account.id) === user?.id
                        return (
                          <tr key={account.id}>
                            <td>
                              <strong>{account.username}</strong>
                              <span className="account-email">
                                {account.email}
                              </span>
                              {self && (
                                <span className="text-muted text-xs">
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
                            <td>{account.role}</td>
                            <td>
                              <span
                                className={`account-status account-status--${account.active ? 'active' : 'inactive'}`}
                              >
                                {account.active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <div className="account-actions">
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    setDialog({ action: 'edit', account })
                                  }
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="secondary"
                                  disabled={self}
                                  title={
                                    self
                                      ? 'You cannot deactivate your own account'
                                      : undefined
                                  }
                                  onClick={() =>
                                    setDialog({
                                      action: account.active
                                        ? 'deactivate'
                                        : 'activate',
                                      account,
                                    })
                                  }
                                >
                                  {account.active ? 'Deactivate' : 'Reactivate'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  disabled={self}
                                  title={
                                    self
                                      ? 'Use the change password page for your own account'
                                      : undefined
                                  }
                                  onClick={() =>
                                    setDialog({
                                      action: 'resetPassword',
                                      account,
                                    })
                                  }
                                >
                                  Reset password
                                </Button>
                                {self && (
                                  <Link
                                    className="text-link"
                                    to="/change-password"
                                  >
                                    Change my password
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="management-empty">
                  {query.role ||
                  query.active !== undefined ||
                  query.departmentId
                    ? 'No accounts match your filters.'
                    : 'No accounts yet.'}
                </p>
              )}
            </>
          )}
          <div className="management-pagination">
            <div className="user-field">
              <label htmlFor="page-size">Rows per page</label>
              <Select
                id="page-size"
                value={query.size}
                onChange={(e) =>
                  filter({
                    size: Number(e.target.value) as AccountQuery['size'],
                  })
                }
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </div>
            <span>
              Page {query.page + 1} / {pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={loading || query.page <= 0}
                onClick={() =>
                  setQuery((previous) => ({
                    ...previous,
                    page: previous.page - 1,
                  }))
                }
              >
                Previous page
              </Button>
              <Button
                variant="secondary"
                disabled={loading || query.page + 1 >= pages}
                onClick={() =>
                  setQuery((previous) => ({
                    ...previous,
                    page: previous.page + 1,
                  }))
                }
              >
                Next page
              </Button>
            </div>
          </div>
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
      {dialog && dialog.action !== 'edit' && (
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
