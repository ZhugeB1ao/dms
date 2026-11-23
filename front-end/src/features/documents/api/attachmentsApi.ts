import { api } from '@/shared/api/http.ts'
import type {
  AttachmentSignedUrl,
  DocumentAttachment,
} from '@/features/documents/types.ts'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx'

const ALLOWED_MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const ALLOWED_MIMES = new Set(Object.values(ALLOWED_MIME_BY_EXT))
const PREVIEWABLE_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
])

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

export function isPreviewableMime(mimeType: string): boolean {
  return PREVIEWABLE_MIMES.has(mimeType.toLowerCase())
}

export function resolveAttachmentMime(
  fileName: string,
  mimeType: string,
): string | null {
  const ext = fileExtension(fileName)
  if (!Object.hasOwn(ALLOWED_MIME_BY_EXT, ext)) return null
  const type = mimeType.toLowerCase()
  if (!type || type === 'application/octet-stream') {
    return ALLOWED_MIME_BY_EXT[ext]
  }
  return ALLOWED_MIMES.has(type) ? type : null
}

export function validateClientFile(file: File): string | null {
  if (file.size <= 0) return 'File is empty.'
  if (file.size > MAX_ATTACHMENT_BYTES) return 'File exceeds the 10 MB limit.'
  if (!resolveAttachmentMime(file.name, file.type)) {
    return 'Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOCX, XLSX.'
  }
  return null
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Number((bytes / 1024).toFixed(1))} KB`
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`
}

export interface UploadAttachmentOptions {
  signal?: AbortSignal
  onProgress?: (percent: number) => void
}

function postAttachmentFile(
  url: string,
  file: File,
  options?: UploadAttachmentOptions,
): Promise<DocumentAttachment> {
  const body = new FormData()
  body.append('file', file)
  return api
    .post<DocumentAttachment>(url, body, {
      timeout: 60000,
      signal: options?.signal,
      onUploadProgress: options?.onProgress
        ? (event) => {
            if (event.total && event.total > 0) {
              options.onProgress?.(
                Math.min(100, Math.round((event.loaded / event.total) * 100)),
              )
            }
          }
        : undefined,
    })
    .then((r) => r.data)
}

export const attachmentsApi = {
  list: (documentId: number, signal?: AbortSignal) =>
    api
      .get<DocumentAttachment[]>(`/documents/${documentId}/attachments`, {
        signal,
      })
      .then((r) => r.data),
  versions: (documentId: number, attachmentId: number, signal?: AbortSignal) =>
    api
      .get<DocumentAttachment[]>(
        `/documents/${documentId}/attachments/${attachmentId}/versions`,
        { signal },
      )
      .then((r) => r.data),
  upload: (documentId: number, file: File, options?: UploadAttachmentOptions) =>
    postAttachmentFile(`/documents/${documentId}/attachments`, file, options),
  replace: (
    documentId: number,
    attachmentId: number,
    file: File,
    options?: UploadAttachmentOptions,
  ) =>
    postAttachmentFile(
      `/documents/${documentId}/attachments/${attachmentId}/replace`,
      file,
      options,
    ),
  remove: async (
    documentId: number,
    attachmentId: number,
    signal?: AbortSignal,
  ): Promise<void> => {
    await api.delete(`/documents/${documentId}/attachments/${attachmentId}`, {
      signal,
    })
  },
  getUrl: (
    documentId: number,
    attachmentId: number,
    disposition: 'inline' | 'attachment' = 'inline',
    signal?: AbortSignal,
  ) =>
    api
      .get<AttachmentSignedUrl>(
        `/documents/${documentId}/attachments/${attachmentId}/url`,
        { params: { disposition }, signal },
      )
      .then((r) => r.data),
}
