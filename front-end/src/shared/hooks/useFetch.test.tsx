import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useFetch } from '@/shared/hooks/useFetch.ts'

it('loads, retries after an error and ignores responses for an old loader', async () => {
  let calls = 0
  const flaky = () =>
    ++calls === 1 ? Promise.reject(new Error('x')) : Promise.resolve('ok')
  const { result } = renderHook(() => useFetch(flaky))
  expect(result.current.loading).toBe(true)
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
  act(() => result.current.retry())
  expect(result.current.loading).toBe(true)
  await waitFor(() => expect(result.current.data).toBe('ok'))

  let resolveSlow!: (value: string) => void
  const slow = () => new Promise<string>((resolve) => (resolveSlow = resolve))
  const fast = () => Promise.resolve('fast')
  const switching = renderHook(({ load }) => useFetch(load), {
    initialProps: { load: slow },
  })
  switching.rerender({ load: fast })
  await waitFor(() => expect(switching.result.current.data).toBe('fast'))
  await act(async () => resolveSlow('stale'))
  expect(switching.result.current.data).toBe('fast')
})
