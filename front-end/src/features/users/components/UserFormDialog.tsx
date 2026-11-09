import Select from '../../../shared/components/Select.tsx'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Button from '../../../shared/components/Button.tsx'
import { useAuth } from '../../auth/context/useAuth.ts'
import {
  departmentApi,
  type DepartmentItem,
} from '../../departments/api/departmentApi.ts'
import { usersApi } from '../api/usersApi.ts'
import { userError } from '../api/userErrors.ts'
import type { AccountWrite, ManagedAccount } from '../types.ts'
import type { Role } from '../../../shared/types/domain.ts'
import AccountDialog from './AccountDialog.tsx'
import FormField from './FormField.tsx'
import { validateForm, focusError, errorAttributes } from './formValidation.ts'

export default function UserFormDialog({
  account,
  onClose,
  onSaved,
}: {
  account: ManagedAccount | null
  onClose: () => void
  onSaved: (account: ManagedAccount, warning?: string) => void
}) {
  const auth = useAuth()
  const self = auth.user?.id === String(account?.id)
  const [role, setRole] = useState<Role>(account?.role ?? 'EMPLOYEE')
  const [department, setDepartment] = useState(
    String(account?.departmentId ?? ''),
  )
  const [departments, setDepartments] = useState<DepartmentItem[] | null>(null)
  const [optionError, setOptionError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const request = useRef<AbortController | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!pending && formRef.current && Object.keys(errors).length)
      focusError(formRef.current, errors)
  }, [pending, errors])
  useEffect(() => {
    const controller = new AbortController()
    departmentApi
      .listTree(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setDepartments(items)
          setOptionError('')
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setOptionError(userError(error).message)
      })
    return () => controller.abort()
  }, [attempt])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !departments) return
    const form = event.currentTarget
    const next = validateForm(form)
    setErrors(next)
    setMessage('')
    if (Object.keys(next).length) {
      focusError(form, next)
      return
    }
    const values = Object.fromEntries(new FormData(form))
    const input: AccountWrite = {
      email: String(values.email).trim(),
      role,
      departmentId: Number(values.departmentId),
      position: String(values.position ?? '').trim() || null,
    }
    busy.current = true
    setPending(true)
    const controller = new AbortController()
    request.current = controller
    try {
      const saved = account
        ? await usersApi.update(account.id, input, controller.signal)
        : await usersApi.create(
            {
              ...input,
              username: String(values.username).trim(),
              tempPassword: String(values.tempPassword),
            },
            controller.signal,
          )
      if (controller.signal.aborted) return
      let warning: string | undefined
      if (self) {
        try {
          await auth.reloadUser(controller.signal)
        } catch {
          warning =
            'Account saved, but session details could not be refreshed. Please reload the page.'
        }
      }
      if (!controller.signal.aborted) {
        form.reset()
        onSaved(saved, warning)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const failure = userError(error)
      setErrors(failure.fieldErrors)
      setMessage(
        Object.keys(failure.fieldErrors).length
          ? 'Check the fields below.'
          : failure.message,
      )
      focusError(form, failure.fieldErrors)
    } finally {
      busy.current = false
      if (!controller.signal.aborted) setPending(false)
    }
  }

  return (
    <AccountDialog
      title={account ? 'Edit account' : 'Create account'}
      pending={pending}
      onClose={onClose}
    >
      <p className="text-muted">
        Account details, department and access permissions.
      </p>
      {!departments && !optionError && (
        <p role="status">Loading departments…</p>
      )}
      {optionError && (
        <div role="alert">
          <p>{optionError}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Reload options
          </Button>
        </div>
      )}
      <form ref={formRef} noValidate onSubmit={submit} className="user-form">
        <fieldset disabled={pending}>
          <div className="user-form-grid">
            <FormField name="username" label="Username" error={errors.username}>
              <input
                id="username"
                name="username"
                type="text"
                required
                maxLength={50}
                pattern="\S+"
                defaultValue={account?.username ?? ''}
                readOnly={Boolean(account)}
                autoComplete="off"
                {...errorAttributes('username', errors)}
              />
              {account && (
                <p className="text-muted text-sm">
                  The username cannot be changed.
                </p>
              )}
            </FormField>
            <FormField name="email" label="Email" error={errors.email}>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={255}
                defaultValue={account?.email ?? ''}
                autoComplete="email"
                {...errorAttributes('email', errors)}
              />
            </FormField>
            <FormField name="role" label="Role" error={errors.role}>
              <Select
                id="role"
                name="role"
                value={role}
                disabled={self}
                onChange={(e) => setRole(e.target.value as Role)}
                {...errorAttributes('role', errors)}
              >
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="EMPLOYEE">Employee</option>
              </Select>
              {self && (
                <p className="text-muted text-sm">
                  You cannot change your own administrator role.
                </p>
              )}
            </FormField>
            <FormField
              name="departmentId"
              label="Department"
              error={errors.departmentId}
            >
              <Select
                id="departmentId"
                name="departmentId"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                {...errorAttributes('departmentId', errors)}
              >
                <option value="">Select a department</option>
                {departments?.map((d) => (
                  <option
                    key={d.id}
                    value={d.id}
                    disabled={!d.isActive && d.id !== account?.departmentId}
                  >
                    {d.name} ({d.code}){!d.isActive ? ' (inactive)' : ''}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField name="position" label="Position" error={errors.position}>
              <input
                id="position"
                name="position"
                type="text"
                maxLength={100}
                defaultValue={account?.position ?? ''}
                {...errorAttributes('position', errors)}
              />
            </FormField>
            {!account &&
              (['tempPassword', 'confirmPassword'] as const).map((name) => (
                <FormField
                  key={name}
                  name={name}
                  label={
                    name === 'tempPassword'
                      ? 'Temporary password'
                      : 'Confirm password'
                  }
                  error={errors[name]}
                >
                  <input
                    id={name}
                    name={name}
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    {...errorAttributes(name, errors)}
                  />
                </FormField>
              ))}
          </div>
          {!account && (
            <p className="text-muted text-sm">
              The user must change this password at the first login.
            </p>
          )}
        </fieldset>
        {message && <p role="alert">{message}</p>}
        <div className="user-dialog-actions">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !departments}>
            {pending ? 'Saving…' : 'Save account'}
          </Button>
        </div>
      </form>
    </AccountDialog>
  )
}
