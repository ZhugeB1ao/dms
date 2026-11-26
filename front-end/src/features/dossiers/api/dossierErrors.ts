import { getApiErrorMessage } from '@/shared/api/http.ts'

const fallbacks: Record<number, string> = {
  400: 'Check the fields below.',
  401: 'Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'This record no longer exists.',
  409: 'This record conflicts with an existing or closed record.',
  422: 'Check the fields below.',
}

export function dossierError(error: unknown) {
  const response = (
    error as {
      response?: {
        status?: number
        data?: { fieldErrors?: unknown }
      }
    }
  )?.response
  const status = response?.status
  const raw = response?.data?.fieldErrors
  const fields: Record<string, string> =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? Object.fromEntries(
          Object.entries(raw).filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === 'string' && entry[1].trim().length > 0,
          ),
        )
      : {}
  const fallback =
    fallbacks[status ?? 0] ?? 'Unable to complete the request. Try again.'
  return {
    status,
    message: getApiErrorMessage(error, fallback),
    fields,
  }
}
