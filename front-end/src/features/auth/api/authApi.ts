import { api, authHttp } from '../../../shared/api/http.ts'
import type { Role, User } from '../../../shared/types/domain.ts'

export interface RawUser {
  id: string | number
  username?: string
  email?: string
  displayName?: string
  role?: Role
  roles?: Role[]
  departmentId?: string | number | null
}

export interface LoginResult {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
  user?: RawUser
}

export function normalizeUser(raw: RawUser): User {
  const roles = Array.isArray(raw.roles)
    ? raw.roles
    : raw.role
      ? [raw.role]
      : []
  return {
    id: String(raw.id),
    ...(raw.username ? { username: raw.username } : {}),
    ...(raw.email ? { email: raw.email } : {}),
    displayName: raw.displayName || raw.username || raw.email || String(raw.id),
    roles,
    departmentId:
      raw.departmentId !== undefined && raw.departmentId !== null
        ? String(raw.departmentId)
        : null,
  }
}

export const authApi = {
  login: (values: Record<string, unknown>, signal?: AbortSignal) =>
    authHttp
      .post<LoginResult>('/auth/login', values, { signal })
      .then((r) => r.data),
  me: (signal?: AbortSignal) =>
    api
      .get<RawUser>('/accounts/me', { skipRefresh: true, signal })
      .then((r) => normalizeUser(r.data)),
  logout: (refreshToken?: string | null) =>
    authHttp.post('/auth/logout', refreshToken ? { refreshToken } : {}),
  forgot: (values: Record<string, unknown>, signal?: AbortSignal) =>
    authHttp.post('/auth/forgot-password', values, { signal }),
  change: (values: Record<string, unknown>, signal?: AbortSignal) =>
    api.post('/accounts/me/change-password', values, { signal }),
}
