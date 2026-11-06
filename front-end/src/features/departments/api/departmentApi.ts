import { categoryHttp } from '../../../shared/api/http.ts'

export interface DepartmentItem {
  id: number
  code: string
  name: string
  parentId: number | null
  isActive: boolean
  children?: DepartmentItem[]
}

export interface DepartmentRow extends DepartmentItem {
  depth: number
  parentName: string | null
}

export function normalizeDepartments(data: DepartmentItem[]): DepartmentItem[] {
  return data.flatMap(({ children, ...item }) => [
    { ...item, parentId: item.parentId ?? null },
    ...(children ? normalizeDepartments(children) : []),
  ])
}

export function buildDepartmentRows(items: DepartmentItem[]): DepartmentRow[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const visit = (parentId: number | null, depth: number): DepartmentRow[] =>
    items
      .filter(
        (i) =>
          (i.parentId && byId.has(i.parentId) ? i.parentId : null) === parentId,
      )
      .flatMap((i) => {
        const p = i.parentId ? byId.get(i.parentId) : undefined
        return [
          {
            ...i,
            depth,
            parentName: p ? `${p.name} (${p.code})` : null,
          },
          ...(depth < 3 ? visit(i.id, depth + 1) : []),
        ]
      })
  return visit(null, 1)
}

export function getForbiddenParentIds(
  items: DepartmentItem[],
  editingId?: number | null,
): Set<number> {
  const rows = buildDepartmentRows(items)
  const isDescendant = (id: number, targetId: number): boolean => {
    const cur = items.find((i) => i.id === id)
    if (!cur?.parentId) return false
    return cur.parentId === targetId || isDescendant(cur.parentId, targetId)
  }
  const subtreeHeight = (id: number): number => {
    const kids = items.filter((i) => i.parentId === id)
    return kids.length
      ? 1 + Math.max(...kids.map((k) => subtreeHeight(k.id)))
      : 1
  }
  const h = editingId ? subtreeHeight(editingId) : 1
  return new Set(
    rows
      .filter(
        (r) =>
          r.id === editingId ||
          (editingId ? isDescendant(r.id, editingId) : false) ||
          r.depth + h > 3,
      )
      .map((r) => r.id),
  )
}

export const departmentApi = {
  listTree: (signal?: AbortSignal) =>
    categoryHttp
      .get<DepartmentItem[]>('/departments/tree', { signal })
      .then((r) => normalizeDepartments(r.data)),

  listActive: (signal?: AbortSignal) =>
    categoryHttp
      .get<DepartmentItem[]>('/departments/active', { signal })
      .then((r) => normalizeDepartments(r.data)),

  create: (values: Record<string, unknown>, signal?: AbortSignal) =>
    categoryHttp
      .post<DepartmentItem>('/departments', values, { signal })
      .then((r) => r.data),

  update: (id: number, values: Record<string, unknown>, signal?: AbortSignal) =>
    categoryHttp
      .put<DepartmentItem>(`/departments/${id}`, values, { signal })
      .then((r) => r.data),

  deactivate: (id: number, signal?: AbortSignal) =>
    categoryHttp
      .patch<DepartmentItem>(`/departments/${id}/deactivate`, null, { signal })
      .then((r) => r.data),
}
