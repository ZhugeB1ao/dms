import { useEffect, useRef, useState, type ReactNode } from 'react'
import axios from 'axios'
import { session, refreshSession } from '../../../shared/api/http.ts'
import type { User } from '../../../shared/types/domain.ts'
import { authApi, normalizeUser } from '../api/authApi.ts'
import { AuthContext, type AuthStatus } from './useAuth.ts'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: AuthStatus; user: User | null }>(
    {
      status: 'loading',
      user: null,
    },
  )
  const bootstrap = useRef<Promise<void> | null>(null)
  const revision = useRef(0)
  const activeUserId = useRef<string | null>(null)
  const intentionalClear = useRef(false)
  const [sessionNotice, setSessionNotice] = useState<
    'expired' | 'passwordChanged' | null
  >(null)

  async function restore() {
    if (!session.refreshToken) {
      setState({ status: 'unauthenticated', user: null })
      return
    }
    const current = revision.current
    try {
      await refreshSession()
      const user = await authApi.me()
      if (current === revision.current) {
        activeUserId.current = user.id
        setState({ status: 'authenticated', user })
      }
    } catch (error) {
      if (current === revision.current) {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined
        setState({
          status:
            status === 401 || status === 400 ? 'unauthenticated' : 'error',
          user: null,
        })
      }
    }
  }

  useEffect(() => {
    const unsubscribe = session.subscribe(() => {
      if (activeUserId.current) {
        revision.current++
        if (!intentionalClear.current) setSessionNotice('expired')
      }
      activeUserId.current = null
      setState({ status: 'unauthenticated', user: null })
    })
    // Share bootstrap across StrictMode's effect replay.
    bootstrap.current ??= restore()
    return unsubscribe
  }, [])

  async function login(values: Record<string, unknown>, signal?: AbortSignal) {
    revision.current++
    intentionalClear.current = true
    session.clear()
    intentionalClear.current = false
    setSessionNotice(null)
    const current = revision.current
    const data = await authApi.login(values, signal)
    if (signal?.aborted || current !== revision.current)
      throw new Error('Session changed')
    session.set(data.accessToken, data.refreshToken ?? null)
    const user = data.user ? normalizeUser(data.user) : await authApi.me(signal)
    if (signal?.aborted || current !== revision.current) {
      session.clear()
      throw new Error('Session changed')
    }
    activeUserId.current = user.id
    setState({ status: 'authenticated', user })
  }

  async function logout(notice?: 'passwordChanged') {
    revision.current++
    const refreshToken = session.refreshToken
    intentionalClear.current = true
    session.clear()
    intentionalClear.current = false
    setSessionNotice(notice === 'passwordChanged' ? 'passwordChanged' : null)
    if (!refreshToken) return
    try {
      await authApi.logout(refreshToken)
    } catch {
      /* Local logout must also work offline. */
    }
  }

  async function reloadUser(signal?: AbortSignal) {
    const current = revision.current
    const userId = activeUserId.current
    try {
      const user = await authApi.me(signal)
      if (
        !signal?.aborted &&
        current === revision.current &&
        userId === activeUserId.current &&
        user.id === userId
      )
        setState({ status: 'authenticated', user })
    } catch (error) {
      if (
        current === revision.current &&
        axios.isAxiosError(error) &&
        error.response?.status === 401
      )
        session.clear()
      throw error
    }
  }

  return (
    <AuthContext
      value={{
        ...state,
        sessionNotice,
        login,
        logout,
        reloadUser,
        retryBootstrap: () => {
          setState({ status: 'loading', user: null })
          return restore()
        },
      }}
    >
      {children}
    </AuthContext>
  )
}
