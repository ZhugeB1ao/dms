import { useEffect, useRef, useState, type FormEvent } from 'react'
import Button from '../../../shared/components/Button.tsx'
import { usersApi } from '../api/usersApi.ts'
import { userError } from '../api/userErrors.ts'
import type { ManagedAccount, UserAction } from '../types.ts'
import AccountDialog from './AccountDialog.tsx'
import FormField from './FormField.tsx'
import { validateForm, focusError, errorAttributes } from './formValidation.ts'

const titles = {
  deactivate: 'Deactivate account',
  activate: 'Reactivate account',
  resetPassword: 'Reset password',
}
export default function UserActionDialog({
  account,
  action,
  onClose,
  onDone,
  onConflict,
}: {
  account: ManagedAccount
  action: UserAction
  onClose: () => void
  onDone: () => void
  onConflict: () => void
}) {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const busy = useRef(false)
  const request = useRef<AbortController | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!pending && formRef.current && Object.keys(errors).length)
      focusError(formRef.current, errors)
  }, [pending, errors])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    const form = event.currentTarget
    const next = validateForm(form)
    setErrors(next)
    setMessage('')
    if (Object.keys(next).length) {
      focusError(form, next)
      return
    }
    busy.current = true
    setPending(true)
    const controller = new AbortController()
    request.current = controller
    try {
      if (action === 'resetPassword')
        await usersApi.resetPassword(
          account.id,
          { tempPassword: String(new FormData(form).get('tempPassword')) },
          controller.signal,
        )
      else
        await usersApi.setActive(
          account.id,
          action === 'activate',
          controller.signal,
        )
      if (!controller.signal.aborted) {
        form.reset()
        onDone()
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const failure = userError(error)
      setMessage(
        Object.keys(failure.fieldErrors).length
          ? 'Check the fields below.'
          : failure.message,
      )
      setErrors(failure.fieldErrors)
      focusError(form, failure.fieldErrors)
      if (failure.status === 404) onConflict()
    } finally {
      busy.current = false
      if (!controller.signal.aborted) setPending(false)
    }
  }
  return (
    <AccountDialog title={titles[action]} pending={pending} onClose={onClose}>
      <p className="my-4">
        {account.username} · {account.email}
      </p>
      <p className="text-muted">
        {action === 'deactivate'
          ? 'This account will no longer be able to log in. Existing sessions are revoked and data is retained.'
          : action === 'activate'
            ? 'The user can log in again with their current password. Previously issued sessions stay invalid.'
            : 'The user receives a temporary password, must change it at the next login, and all current sessions are revoked.'}
      </p>
      <form ref={formRef} noValidate onSubmit={submit} className="user-form">
        <fieldset disabled={pending}>
          {action === 'resetPassword' &&
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
        </fieldset>
        {message && <p role="alert">{message}</p>}
        <div className="user-dialog-actions">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Processing…' : 'Confirm'}
          </Button>
        </div>
      </form>
    </AccountDialog>
  )
}
