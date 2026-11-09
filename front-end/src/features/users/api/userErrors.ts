import axios from 'axios'

export function userError(error: unknown) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  const data = axios.isAxiosError(error) ? error.response?.data : undefined
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
  return {
    status,
    code: typeof data?.code === 'string' ? data.code : '',
    fieldErrors,
    message:
      (status && messages[status]) ||
      (typeof data?.message === 'string' && data.message) ||
      'Unable to connect. Please try again.',
  }
}
