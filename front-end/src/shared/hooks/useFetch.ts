import { useEffect, useState } from 'react'

/**
 * Runs `load` and refetches whenever its identity changes or `retry()` is called.
 * Keep `load` stable (module-level or `useCallback`). A late response for an
 * old `load` is aborted and ignored, so `loading` flips back on immediately.
 */
export function useFetch<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    load: typeof load
    attempt: number
    data?: T
    error?: unknown
  }>()
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ load, attempt, data })
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult({ load, attempt, error: error ?? new Error('Failed') })
      },
    )
    return () => controller.abort()
  }, [load, attempt])
  const current =
    result?.load === load && result.attempt === attempt ? result : undefined
  return {
    loading: !current,
    data: current?.data,
    error: current?.error,
    retry: () => setAttempt((n) => n + 1),
    /** Replace the loaded value locally, e.g. with a save response. */
    setData: (data: T) => setResult({ load, attempt, data }),
  }
}
