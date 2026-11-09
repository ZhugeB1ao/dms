import Select from '../../../shared/components/Select.tsx'
import { useEffect, useState, type SelectHTMLAttributes } from 'react'
import {
  buildDepartmentRows,
  departmentApi,
  type DepartmentItem,
} from '../api/departmentApi.ts'

export interface DepartmentSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  items?: DepartmentItem[]
  excludeIds?: Set<number>
  placeholder?: string
}

export default function DepartmentSelect({
  items: externalItems,
  excludeIds,
  placeholder = '— None (top-level department) —',
  defaultValue,
  value,
  ...rest
}: DepartmentSelectProps) {
  const [fetchedItems, setFetchedItems] = useState<DepartmentItem[]>([])

  useEffect(() => {
    if (externalItems) return
    const controller = new AbortController()
    departmentApi
      .listActive(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setFetchedItems(data)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [externalItems])

  const source = externalItems ?? fetchedItems
  const rows = buildDepartmentRows(source).filter(
    (row) => row.isActive && !excludeIds?.has(row.id),
  )

  return (
    <Select defaultValue={defaultValue} value={value} {...rest}>
      <option value="">{placeholder}</option>
      {rows.map((row) => {
        const prefix = row.depth > 1 ? `${'— '.repeat(row.depth - 1)}` : ''
        return (
          <option key={row.id} value={String(row.id)}>
            {prefix}
            {row.name} ({row.code})
          </option>
        )
      })}
    </Select>
  )
}
