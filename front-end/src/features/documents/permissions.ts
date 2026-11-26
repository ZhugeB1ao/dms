import type { User } from '@/shared/types/domain.ts'
import type {
  DocumentDetail,
  DocumentSummary,
  WorkflowCommand,
} from '@/features/documents/types.ts'

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

export function canUseApprovalInbox(user: User | null): boolean {
  return user?.roles.includes('MANAGER') ?? false
}

export const workflowSourceStatus: Record<WorkflowCommand['action'], string> = {
  submit: 'DRAFT',
  approve: 'PENDING_APPROVAL',
  reject: 'PENDING_APPROVAL',
  publish: 'READY_TO_PUBLISH',
  recall: 'PUBLISHED',
}

export function hasWorkflowAuthority(
  user: User | null,
  doc: DocumentDetail,
  action: WorkflowCommand['action'],
): boolean {
  if (!user || !canViewDocument(user, doc)) return false
  if (action === 'submit') return String(doc.createdBy) === user.id
  if (action === 'publish') return doc.canPublish === true
  if (
    !canUseApprovalInbox(user) ||
    String(doc.departmentId) !== user.departmentId
  )
    return false
  return action === 'recall' || String(doc.reviewerId) === user.id
}

export function canRunWorkflowAction(
  user: User | null,
  doc: DocumentDetail,
  action: WorkflowCommand['action'],
): boolean {
  return (
    doc.status === workflowSourceStatus[action] &&
    hasWorkflowAuthority(user, doc, action)
  )
}
