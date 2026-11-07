import { useEffect, useRef, type MouseEvent } from 'react'
import SignupDemoForm, { type DemoAuthMode } from './SignupDemoForm.tsx'
import Button from '../../../shared/components/Button.tsx'
import { CloseIcon } from '../../../shared/components/Icons.tsx'

export interface SignupDemoModalProps {
  open: boolean
  mode: DemoAuthMode
  onClose: () => void
  onSwitch: (mode: DemoAuthMode) => void
}

export default function SignupDemoModal({
  open,
  mode,
  onClose,
  onSwitch,
}: SignupDemoModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    if (open) {
      // Keep focus in the new form without opening the mobile keyboard automatically.
      const target = window.matchMedia('(max-width: 767px)').matches
        ? '#auth-title'
        : 'input'
      dialog.querySelector<HTMLElement>(target)?.focus()
    }
  }, [mode, open])

  const isSignup = mode === 'signup'

  function closeDialog() {
    dialogRef.current?.close()
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeDialog()
  }

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-labelledby="auth-title"
      aria-describedby="auth-description"
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="auth-panel">
        <Button
          variant="icon"
          className="modal-close"
          aria-label="Close form"
          onClick={closeDialog}
        >
          <CloseIcon />
        </Button>
        <div className="text-center">
          <span className="modal-eyebrow" translate="no">
            APP
          </span>
          <h1 id="auth-title" className="modal-title" tabIndex={-1}>
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p
            id="auth-description"
            className="mt-2 text-sm leading-6 text-muted"
          >
            {isSignup
              ? 'A fresh start. Make it yours.'
              : 'Log in to pick up where you left off.'}
          </p>
        </div>
        <SignupDemoForm
          key={`${mode}-${open}`}
          mode={mode}
          onSwitch={onSwitch}
        />
        <p className="mt-7 text-center text-xs leading-5 text-muted">
          Interface preview · No account connection yet
        </p>
      </div>
    </dialog>
  )
}
