import { api, authHttp } from '../../../shared/api/http.ts'
import type { User } from '../../../shared/types/domain.ts'

export interface LoginResult {
  accessToken: string
  expiresIn?: number
  user: User
}

export const authApi = {
  login: (values: Record<string, unknown>, signal?: AbortSignal) =>
    authHttp
      .post<LoginResult>('/auth/login', values, { signal })
      .then((r) => r.data),
  me: () =>
    api.get<User>('/auth/me', { skipRefresh: true }).then((r) => r.data),
  logout: () => authHttp.post('/auth/logout'),
  forgot: (values: Record<string, unknown>, signal?: AbortSignal) =>
    authHttp.post('/auth/forgot-password', values, { signal }),
  change: (values: Record<string, unknown>, signal?: AbortSignal) =>
    api.post('/auth/change-password', values, { signal }),
}
