import type { ReactNode } from 'react'

export default function FormField({
  name,
  label,
  error,
  children,
}: {
  name: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="user-field">
      <label htmlFor={name}>{label}</label>
      {children}
      {error && (
        <p id={`${name}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
