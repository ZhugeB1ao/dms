import type { ComponentPropsWithRef } from 'react'
import './Select.css'

export type SelectProps = ComponentPropsWithRef<'select'>

/** Native select semantics with a shared, progressively enhanced picker. */
export default function Select({ className = '', ...props }: SelectProps) {
  return <select className={`select-control ${className}`} {...props} />
}
