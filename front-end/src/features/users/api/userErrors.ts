import axios from 'axios'

// account-service answers 409 with "Username already exists" / "Email already exists"
// and no fieldErrors, so the conflicting field is read from the message.
function conflictFieldErrors(message: string): Record<string, string> {
  const text = message.toLowerCase()
  if (text.includes('username') && !text.includes('email'))
    return { username: 'This username is already taken.' }
  if (text.includes('email') && !text.includes('username'))
    return { email: 'This email is already in use.' }
  return {}
}

export function userError(error: unknown) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const data = axios.isAxiosError(error) ? error.response?.data : undefined
  const serverMessage = typeof data?.message === 'string' ? data.message : ''
  const messages: Record<number, string> = {
    401: 'Your session has expired. Please log in again.',
    403: 'You do not have permission to perform this action.',
    404: 'Account not found. Please reload the list.',
    409: 'This username or email is already in use.',
  }
  const fieldErrors = Object.fromEntries(
    Object.entries(data?.fieldErrors ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
  if (status === 409 && !Object.keys(fieldErrors).length)
    Object.assign(fieldErrors, conflictFieldErrors(serverMessage))
  // Spring's raw bean-validation text ("Validation failed for object=...") is not user-facing.
  const readableServerMessage = serverMessage.startsWith('Validation failed')
    ? 'Some fields are invalid. Please check your input.'
    : serverMessage
  return {
    status,
    code: typeof data?.code === 'string' ? data.code : '',
    fieldErrors,
    message:
      (status && messages[status]) ||
      readableServerMessage ||
      'Unable to connect. Please try again.',
  }
}
