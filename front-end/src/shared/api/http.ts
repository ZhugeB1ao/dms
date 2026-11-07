import axios from 'axios'
import { env } from '../../config/env.ts'

declare module 'axios' {
  export interface AxiosRequestConfig {
    sessionGeneration?: number
    retried?: boolean
    skipRefresh?: boolean
  }
  export interface InternalAxiosRequestConfig {
    sessionGeneration?: number
    retried?: boolean
    skipRefresh?: boolean
  }
}

type SessionListener = () => void

const listeners = new Set<SessionListener>()
let generation = 0
let refreshPromise: Promise<string> | null = null

export const session = {
  token: null as string | null,
  set(token: string | null) {
    this.token = token
  },
  clear() {
    this.token = null
    generation++
    refreshPromise = null
    listeners.forEach((fn) => fn())
  },
  subscribe(fn: SessionListener) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}

export const authHttp = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
})
export const api = axios.create({ baseURL: env.apiBaseUrl, timeout: 10000 })

export function refreshSession(): Promise<string> {
  if (!refreshPromise) {
    const current = generation
    const pending = authHttp
      .post<{ accessToken: string }>('/auth/refresh')
      .then(({ data }) => {
        if (current !== generation) throw new Error('Session changed')
        session.set(data.accessToken)
        return data.accessToken
      })
      .catch((error) => {
        if (current === generation) session.clear()
        throw error
      })
      .finally(() => {
        if (refreshPromise === pending) refreshPromise = null
      })
    refreshPromise = pending
  }
  return refreshPromise
}

api.interceptors.request.use((config) => {
  config.sessionGeneration ??= generation
  if (session.token) config.headers.Authorization = `Bearer ${session.token}`
  return config
})

api.interceptors.response.use(
  (response) => {
    if (response.config.sessionGeneration !== generation)
      return Promise.reject(new Error('Session changed'))
    return response
  },
  async (error) => {
    const config = error.config
    if (!config || error.response?.status !== 401 || config.skipRefresh)
      throw error
    if (config.sessionGeneration !== generation) throw error
    if (config.retried) {
      session.clear()
      throw error
    }
    config.retried = true
    const sentToken = config.headers?.Authorization
    if (!session.token || sentToken === `Bearer ${session.token}`)
      await refreshSession()
    if (config.sessionGeneration !== generation) throw error
    config.headers.Authorization = `Bearer ${session.token}`
    return api(config)
  },
)

const rawCategoryBaseUrl = import.meta.env.VITE_CATEGORY_API_URL as
  string | undefined
const categoryBaseUrl =
  import.meta.env.DEV &&
  (!rawCategoryBaseUrl || rawCategoryBaseUrl === 'http://localhost:8080/api')
    ? '/category-api'
    : rawCategoryBaseUrl || 'http://localhost:8080/api'

export const categoryHttp = axios.create({
  baseURL: categoryBaseUrl,
  timeout: 10000,
})

categoryHttp.interceptors.request.use((config) => {
  if (session.token?.startsWith('mock-admin')) {
    config.headers.Authorization = 'Bearer ADMIN'
  } else if (session.token?.startsWith('mock-manager')) {
    config.headers.Authorization = 'Bearer MANAGER'
  } else if (session.token?.startsWith('mock-employee')) {
    config.headers.Authorization = 'Bearer EMPLOYEE'
  }
  return config
})

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}
