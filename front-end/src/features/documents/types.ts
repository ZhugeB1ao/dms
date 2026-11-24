export type DocumentDirection = 'INCOMING' | 'OUTGOING' | 'INTERNAL'
export const documentDirections: Record<DocumentDirection, string> = {
  INCOMING: 'Incoming',
  OUTGOING: 'Outgoing',
  INTERNAL: 'Internal',
}
export const documentStatuses: Record<string, string> = {
  DRAFT: 'Draft',
  READY_TO_PUBLISH: 'Ready to publish',
  PUBLISHED: 'Published',
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
  dossierId?: number | null
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
  dossier?: {
    id: number
    code: string
    name: string
    year: number
    closed: boolean
  } | null
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
}
export interface DocumentAttachment {
  id: number
  documentId: number
  fileGroupId: string
  fileName: string
  mimeType: string
  fileSize: number
  versionNo: number
  isCurrent: boolean
  uploadedBy: number
  uploadedAt: string
}
export interface AttachmentSignedUrl {
  url: string
  expiresAt: string
  expiresInSeconds: number
  disposition: 'inline' | 'attachment'
}
