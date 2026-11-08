import { readFileSync } from 'node:fs'
import Ajv from 'ajv'
import axios from 'axios'
import { beforeAll, afterAll, afterEach, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers, resetMock } from './handlers.ts'
import { api, authHttp, session } from '../shared/api/http.ts'

const spec = JSON.parse(
  readFileSync('docs/api/openapi-auth.proposal.yaml', 'utf8'),
)
const ajv = new Ajv({
  strict: false,
  formats: { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
})
function valid(name: string, data: unknown) {
  const validate = ajv.compile({
    ...spec.components.schemas[name],
    components: spec.components,
  })
  expect(validate(data), JSON.stringify(validate.errors)).toBe(true)
}
const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  resetMock()
  session.clear()
})

it('matches auth-service schemas for username login, me, refresh, recovery, errors and logout', async () => {
  const credentials = { username: 'employee', password: 'Demo12345!' }
  valid('LoginRequest', credentials)
  const login = await authHttp.post('/auth/login', credentials)
  valid('AuthResult', login.data)
  session.set(login.data.accessToken, login.data.refreshToken)
  valid('MeUser', (await api.get('/auth/me')).data)
  const refreshed = await authHttp.post('/auth/refresh', {
    refreshToken: login.data.refreshToken,
  })
  valid('AuthResult', refreshed.data)
  valid(
    'Message',
    (
      await authHttp.post('/auth/forgot-password', {
        email: 'employee@demo.test',
      })
    ).data,
  )
  try {
    await authHttp.post('/auth/login', { ...credentials, password: 'bad' })
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      valid('Error', error.response.data)
      expect(error.response.status).toBe(401)
    } else {
      throw error
    }
  }
  const logout = await authHttp.post('/auth/logout', {
    refreshToken: refreshed.data.refreshToken,
  })
  expect(logout.status).toBe(200)
  valid('Message', logout.data)
  expect(Object.keys(spec.paths)).toHaveLength(6)
})
