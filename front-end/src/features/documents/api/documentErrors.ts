export function documentError(error: unknown) {
  const response = (
    error as {
      response?: { status?: number; data?: { fieldErrors?: unknown } }
    }
  )?.response
  const status = response?.status
  const messages: Record<number, string> = {
    401: 'Please log in again.',
    403: 'You do not have permission to perform this action.',
    404: 'This document no longer exists.',
    409: 'The document changed. Reload before continuing.',
    400: 'Check the fields below.',
    422: 'Check the fields below.',
    413: 'File exceeds the 10 MB limit.',
    415: 'Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOCX, XLSX.',
  }
  const raw = response?.data?.fieldErrors
  const fields: Record<string, string> =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? Object.fromEntries(
          Object.entries(raw).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {}
  return {
    status,
    message:
      messages[status ?? 0] ?? 'Unable to complete the request. Try again.',
    fields,
  }
}
