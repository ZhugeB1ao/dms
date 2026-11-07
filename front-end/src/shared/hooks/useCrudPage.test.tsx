import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useCrudPage } from './useCrudPage.ts'

interface TestItem {
  id: number
  code: string
  name: string
  isActive: boolean
}

const seedItems: TestItem[] = [
  { id: 1, code: 'A', name: 'Item A', isActive: true },
  { id: 2, code: 'B', name: 'Item B', isActive: true },
]

it('loại bỏ mục vừa ngưng dùng khỏi danh sách khi đang lọc Active only và truyền AbortSignal', async () => {
  const fetchList = vi.fn(async () => seedItems)
  const deactivateItem = vi.fn(async (id: number, signal?: AbortSignal) => {
    expect(signal).toBeInstanceOf(AbortSignal)
    return { id, code: 'A', name: 'Item A', isActive: false }
  })

  const { result } = renderHook(() =>
    useCrudPage<TestItem>({
      fetchList,
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deactivateItem,
      loadErrorMessage: 'Load error',
      deactivateErrorMessage: 'Deactivate error',
    }),
  )

  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.items).toHaveLength(2)

  act(() => {
    result.current.setStatusFilter('active')
  })
  await waitFor(() => expect(result.current.loading).toBe(false))

  act(() => {
    result.current.openDeactivateModal(seedItems[0])
  })
  await act(async () => {
    await result.current.handleConfirmDeactivate()
  })

  expect(deactivateItem).toHaveBeenCalledWith(1, expect.any(AbortSignal))
  expect(result.current.items).toEqual([
    { id: 2, code: 'B', name: 'Item B', isActive: true },
  ])
})
