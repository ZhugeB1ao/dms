import { useRef, useState, type FormEvent } from 'react'
import Button from '../../../shared/components/Button.tsx'

export type DemoAuthMode = 'login' | 'signup'

export interface SignupDemoFormProps {
  mode: DemoAuthMode
  onSwitch: (mode: DemoAuthMode) => void
}

export default function SignupDemoForm({
  mode,
  onSwitch,
}: SignupDemoFormProps) {
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  )
  const [submitted, setSubmitted] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const isSignup = mode === 'signup'

  function handleSwitchMode() {
    onSwitch(isSignup ? 'login' : 'signup')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const emailInput = emailRef.current
    const passwordInput = passwordRef.current
    if (!emailInput || !passwordInput) return

    const email = emailInput.value.trim()
    const password = passwordInput.value
    const nextErrors: { email?: string; password?: string } = {}
    if (!email) nextErrors.email = 'Enter your email address.'
    else if (!emailInput.validity.valid)
      nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Enter your password.'
    setErrors(nextErrors)
    setSubmitted(false)
    if (nextErrors.email || nextErrors.password) {
      ;(nextErrors.email ? emailInput : passwordInput).focus()
      return
    }
    // Demo only: never persist credentials or send them to a server.
    passwordInput.value = ''
    setSubmitted(true)
  }

  return (
    <>
      <form
        className="mt-7 flex flex-col gap-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <div>
          <label htmlFor="auth-email" className="field-label">
            Email
          </label>
          <input
            ref={emailRef}
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            autoCapitalize="none"
            placeholder="you@example.com"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email ? (
            <p id="email-error" className="field-error" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="auth-password" className="field-label">
            Password
          </label>
          <input
            ref={passwordRef}
            id="auth-password"
            name="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder="Enter your password"
            required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          {errors.password ? (
            <p id="password-error" className="field-error" role="alert">
              {errors.password}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full">
          {isSignup ? 'Sign up' : 'Log in'}
        </Button>
        <p
          role="status"
          className={`demo-message ${submitted ? '' : 'hidden'}`}
        >
          Demo only — your form is valid.{' '}
          {isSignup
            ? 'No account was created.'
            : 'You have not been signed in.'}
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {isSignup ? 'Already have an account?' : 'Don’t have an account?'}{' '}
        <button type="button" className="text-link" onClick={handleSwitchMode}>
          {isSignup ? 'Log in' : 'Sign up'}
        </button>
      </p>
    </>
  )
}
