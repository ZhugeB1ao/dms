export type DocumentDirection = 'INCOMING' | 'OUTGOING' | 'INTERNAL'
export const documentDirections: Record<DocumentDirection, string> = {
  INCOMING: 'Incoming',
  OUTGOING: 'Outgoing',
  INTERNAL: 'Internal',
}
export const documentStatuses: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  READY_TO_PUBLISH: 'Ready to publish',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
  RECALLED: 'Recalled',
}
export interface Lookup {
  id: number
  name: string
  isActive: boolean
}
export interface DraftInput {
  direction: DocumentDirection
  summary: string
  documentTypeId: number
  urgencyId: number
  confidentialityId: number
  issuingOrganizationId: number
  departmentId: number
}
export interface DocumentSummary extends DraftInput {
  id: number
  createdBy: number
  assigneeIds: number[]
  status: string
  documentTypeName: string
  issuingOrganizationName: string
  departmentName: string
  createdAt: string
  updatedAt: string
}
export interface DocumentDetail extends DocumentSummary {
  version: number
  reviewerId?: number
  reviewerName?: string
  submittedAt?: string
  submittedByName?: string
  documentNumber?: string
  canPublish?: boolean
  lookups: Record<
    | 'documentType'
    | 'urgency'
    | 'confidentiality'
    | 'issuingOrganization'
    | 'department',
    Lookup
  >
}
export interface DocumentQuery {
  direction: DocumentDirection
  status?: string
  documentTypeId?: number
  departmentId?: number
  page: number
  size: 10 | 20 | 50
}
export interface DocumentPage {
  content: DocumentSummary[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}
export interface StatusHistoryEntry {
  id: number
  fromStatus: string | null
  toStatus: string
  actorName: string
  occurredAt: string
  note?: string
  action?: WorkflowCommand['action']
}
export interface DocumentAttachment {
  id: number
  fileName: string
  sizeBytes: number
  contentType: string
  uploadedBy: string
  uploadedAt: string
  canDownload?: boolean
}

export type WorkflowCommand = { version: number } & (
  | { action: 'submit'; reviewerId: number }
  | { action: 'approve' | 'publish' }
  | { action: 'reject' | 'recall'; reason: string }
)

export interface Reviewer {
  id: number
  name: string
}

export type PendingQuery = Pick<
  DocumentQuery,
  'page' | 'size' | 'documentTypeId'
> & {
  direction?: DocumentDirection
}

export interface PendingApprovals extends Omit<DocumentPage, 'content'> {
  content: (DocumentSummary & {
    submittedByName: string
    submittedAt: string
  })[]
  pendingCount: number
}
