import type { User } from '@/shared/types/domain.ts'
import type { DocumentSummary } from '@/features/documents/types.ts'

type DocumentScope = Pick<
  DocumentSummary,
  'departmentId' | 'createdBy' | 'assigneeIds' | 'status'
>
export function canViewDocument(
  user: User | null,
  doc: DocumentScope,
): boolean {
  if (!user) return false
  return (
    user.roles.includes('ADMIN') ||
    (user.roles.includes('MANAGER') &&
      String(doc.departmentId) === user.departmentId) ||
    (user.roles.includes('EMPLOYEE') &&
      (String(doc.createdBy) === user.id ||
        doc.assigneeIds.some((id) => String(id) === user.id)))
  )
}
export function canEditDraft(user: User | null, doc: DocumentScope): boolean {
  return (
    doc.status === 'DRAFT' &&
    Boolean(
      user &&
      (user.roles.includes('ADMIN') ||
        (user.roles.includes('MANAGER') &&
          String(doc.departmentId) === user.departmentId) ||
        (user.roles.includes('EMPLOYEE') && String(doc.createdBy) === user.id)),
    )
  )
}
export const canDeleteDraft = canEditDraft
