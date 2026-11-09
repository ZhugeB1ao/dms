import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Button from '../../../shared/components/Button.tsx'
import { useAuth } from '../../auth/context/useAuth.ts'
import { departmentApi } from '../../departments/api/departmentApi.ts'
import { usersApi } from '../api/usersApi.ts'
import { userError } from '../api/userErrors.ts'
import type { ManagedAccount } from '../types.ts'

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<{
    account: ManagedAccount
    departmentName: string | null
  } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setProfile(null)
    setError('')
    Promise.all([
      usersApi.me(controller.signal),
      // The department name is a nicety; the profile still loads without it.
      departmentApi.listActive(controller.signal).catch(() => []),
    ])
      .then(([account, departments]) => {
        if (!controller.signal.aborted)
          setProfile({
            account,
            departmentName:
              departments.find((d) => d.id === account.departmentId)?.name ??
              null,
          })
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(userError(failure).message)
      })
    return () => controller.abort()
  }, [attempt, user?.id])
  const current =
    profile && String(profile.account.id) === user?.id ? profile : null
  return (
    <section
      className="management-page profile-page"
      aria-labelledby="profile-heading"
    >
      <p className="management-eyebrow">YOUR ACCOUNT</p>
      <h1 id="profile-heading">Personal profile</h1>
      <p className="text-muted mt-3">
        Your current account details and access permissions.
      </p>
      {error ? (
        <div role="alert" className="management-notice">
          <p>{error}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : current ? (
        <dl className="profile-details">
          {[
            ['Username', current.account.username],
            ['Email', current.account.email],
            ['Role', current.account.role],
            [
              'Department',
              current.departmentName ??
                (current.account.departmentId === null
                  ? 'Not assigned'
                  : `#${current.account.departmentId}`),
            ],
            ['Position', current.account.position ?? 'Not assigned'],
            ['Status', current.account.active ? 'Active' : 'Inactive'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p role="status" className="management-empty">
          Loading profile…
        </p>
      )}
      <Link className="button button--primary mt-6" to="/change-password">
        Change password
      </Link>
    </section>
  )
}
