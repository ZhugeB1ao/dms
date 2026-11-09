import { useEffect, useState, type SelectHTMLAttributes } from 'react'
import {
  organizationApi,
  type OrganizationItem,
} from '../api/organizationApi.ts'

export interface OrganizationSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  items?: OrganizationItem[]
  placeholder?: string
}

export default function OrganizationSelect({
  items: externalItems,
  placeholder = '— Select an external organization —',
  defaultValue,
  value,
  ...rest
}: OrganizationSelectProps) {
  const [fetchedItems, setFetchedItems] = useState<OrganizationItem[]>([])

  useEffect(() => {
    if (externalItems) return
    const controller = new AbortController()
    organizationApi
      .listActive(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setFetchedItems(data)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [externalItems])

  const rows = (externalItems ?? fetchedItems).filter((item) => item.isActive)

  return (
    <select defaultValue={defaultValue} value={value} {...rest}>
      <option value="">{placeholder}</option>
      {rows.map((item) => (
        <option key={item.id} value={String(item.id)}>
          {item.name}
        </option>
      ))}
    </select>
  )
}
