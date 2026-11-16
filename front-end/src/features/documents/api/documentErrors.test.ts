import { expect, it } from 'vitest'
import { documentError } from './documentErrors.ts'

it('maps conflicts and accepts only string field errors', () => {
  expect(documentError({ response: { status: 409 } }).message).toMatch(
    /changed/,
  )
  expect(
    documentError({
      response: {
        status: 422,
        data: { fieldErrors: { summary: 'Required', other: {} } },
      },
    }).fields,
  ).toEqual({ summary: 'Required' })
  expect(documentError(new Error('internal stack')).message).toBe(
    'Unable to complete the request. Try again.',
  )
})
