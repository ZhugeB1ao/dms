import { AxiosError, AxiosHeaders } from 'axios'
import { expect, it } from 'vitest'
import { userError } from './userErrors.ts'

function failure(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('failed', String(status), config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  })
}

it('marks the conflicting field from the 409 message', () => {
  expect(
    userError(failure(409, { message: 'Username already exists' })).fieldErrors,
  ).toEqual({
    username: 'This username is already taken.',
  })
  expect(
    userError(failure(409, { message: 'Email already exists' })).fieldErrors,
  ).toEqual({
    email: 'This email is already in use.',
  })
  expect(
    userError(failure(409, { message: 'Username or email already exists' })),
  ).toMatchObject({
    fieldErrors: {},
    message: 'This username or email is already in use.',
  })
})

it('hides raw bean-validation text and keeps other server messages', () => {
  expect(
    userError(
      failure(400, {
        message:
          "Validation failed for object='createAccountRequest'. Error count: 3",
      }),
    ).message,
  ).toBe('Some fields are invalid. Please check your input.')
  expect(
    userError(
      failure(400, { message: 'You cannot deactivate your own account' }),
    ).message,
  ).toBe('You cannot deactivate your own account')
  expect(
    userError(
      failure(401, { message: 'Lỗi xác thực: Invalid compact JWT string' }),
    ).message,
  ).toBe('Your session has expired. Please log in again.')
})
