import type {
  DocumentAttachment,
  DocumentDetail,
  StatusHistoryEntry,
} from '@/features/documents/types.ts'

const lookup = (id: number, name: string) => ({ id, name, isActive: true })
function seed(): DocumentDetail[] {
  return Array.from({ length: 90 }, (_, i) => {
    const direction = (['INCOMING', 'OUTGOING', 'INTERNAL'] as const)[
      Math.floor(i / 30)
    ]
    const departmentId = i % 2 ? 2 : 1
    const departmentName =
      departmentId === 1
        ? 'Board of Directors'
        : 'General Administration Office'
    return {
      id: i + 1,
      direction,
      summary: `${direction[0] + direction.slice(1).toLowerCase()} document ${i + 1}`,
      documentTypeId: 1,
      urgencyId: 4,
      confidentialityId: 7,
      issuingOrganizationId: 1,
      departmentId,
      createdBy: i % 2 ? 1 : 3,
      assigneeIds: i % 4 === 0 ? [3] : [],
      status: ['DRAFT', 'READY_TO_PUBLISH', 'PUBLISHED'][i % 3],
      version: 1,
      documentTypeName: 'Decision',
      departmentName,
      issuingOrganizationName: 'Ministry of Education and Training',
      createdAt: '2026-11-12T02:00:00Z',
      updatedAt: '2026-11-14T02:00:00Z',
      lookups: {
        documentType: lookup(1, 'Decision'),
        urgency: lookup(4, 'Normal'),
        confidentiality: lookup(7, 'Normal'),
        issuingOrganization: lookup(1, 'Ministry of Education and Training'),
        department: lookup(departmentId, departmentName),
      },
    }
  })
}
export const documentStore = {
  documents: seed(),
  histories: new Map<number, StatusHistoryEntry[]>(),
  attachments: new Map<number, DocumentAttachment[]>(),
  attachmentDataUrls: new Map<number, string>(),
  nextId: 91,
  nextAttachmentId: 91,
}
export function resetDocuments() {
  documentStore.documents = seed()
  documentStore.nextId = 91
  documentStore.nextAttachmentId = 91
  documentStore.attachmentDataUrls = new Map()
  documentStore.attachments = new Map(
    documentStore.documents
      .filter((d) => d.id <= 90)
      .map((d) => [
        d.id,
        [
          {
            id: d.id,
            documentId: d.id,
            fileGroupId: 'seed-group-1',
            fileName: 'Sample document.pdf',
            mimeType: 'application/pdf',
            fileSize: 2048,
            versionNo: 1,
            isCurrent: true,
            uploadedBy: 1,
            uploadedAt: d.createdAt,
          },
        ],
      ]),
  )
  documentStore.histories = new Map(
    documentStore.documents.map((d) => [
      d.id,
      [
        {
          id: 1,
          fromStatus: null,
          toStatus: 'DRAFT',
          actorName: 'Demo author',
          occurredAt: d.createdAt,
        },
        ...(d.status === 'DRAFT'
          ? []
          : [
              {
                id: 2,
                fromStatus: 'DRAFT',
                toStatus: 'READY_TO_PUBLISH',
                actorName: 'Demo manager',
                occurredAt: '2026-11-13T02:00:00Z',
              },
            ]),
        ...(d.status !== 'PUBLISHED'
          ? []
          : [
              {
                id: 3,
                fromStatus: 'READY_TO_PUBLISH',
                toStatus: 'PUBLISHED',
                actorName: 'Demo manager',
                occurredAt: d.updatedAt,
              },
            ]),
      ],
    ]),
  )
}
resetDocuments()
