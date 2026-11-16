import type { ReactNode } from 'react'

export default function FormField({
  name,
  label,
  error,
  required,
  children,
}: {
  name: string
  label: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="user-field">
      <label htmlFor={name} className={required ? 'required-label' : undefined}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
