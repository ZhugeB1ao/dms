export function validateForm(form: HTMLFormElement) {
  const errors: Record<string, string> = {}
  for (const field of form.querySelectorAll('input, select')) {
    if (
      !(
        field instanceof HTMLInputElement || field instanceof HTMLSelectElement
      ) ||
      field.disabled
    )
      continue
    if (!field.validity.valid)
      errors[field.name] = field.validity.valueMissing
        ? 'This field is required.'
        : 'Enter a valid value.'
    if (
      field instanceof HTMLInputElement &&
      field.type === 'password' &&
      (field.value.length < 8 || field.value.length > 72)
    )
      errors[field.name] = 'Password must contain 8–72 characters.'
  }
  const values = Object.fromEntries(new FormData(form))
  const password = values.tempPassword
  if (password !== undefined && password !== values.confirmPassword)
    errors.confirmPassword = 'Passwords do not match.'
  return errors
}
export function focusError(
  form: HTMLFormElement,
  errors: Record<string, string>,
) {
  const field = form.elements.namedItem(Object.keys(errors)[0])
  if (field instanceof HTMLElement) field.focus()
}
export function errorAttributes(name: string, errors: Record<string, string>) {
  return {
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  }
}
