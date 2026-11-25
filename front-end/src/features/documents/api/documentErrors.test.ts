import { expect, it } from 'vitest'
import { documentError } from '@/features/documents/api/documentErrors.ts'

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
  expect(documentError({ response: { status: 413 } }).message).toBe(
    'File exceeds the 10 MB limit.',
  )
  expect(documentError({ response: { status: 415 } }).message).toBe(
    'Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOCX, XLSX.',
  )
  expect(
    documentError({
      response: {
        status: 409,
        data: { message: 'Cannot attach document to a closed record.' },
      },
    }).message,
  ).toBe('Cannot attach document to a closed record.')
  expect(
    documentError({
      response: {
        status: 403,
        data: { message: 'Selected record belongs to a different department.' },
      },
    }).message,
  ).toBe('Selected record belongs to a different department.')
})
