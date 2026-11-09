import { createContext, useContext } from 'react'
import type { User } from '../../../shared/types/domain.ts'

export type AuthStatus =
  'loading' | 'authenticated' | 'unauthenticated' | 'error'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  sessionNotice: 'expired' | 'passwordChanged' | null
  login: (
    values: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<void>
  logout: (notice?: 'passwordChanged') => Promise<void>
  reloadUser: (signal?: AbortSignal) => Promise<void>
  retryBootstrap: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
