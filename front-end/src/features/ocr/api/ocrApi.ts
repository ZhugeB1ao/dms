import { env } from '../../../config/env.ts'
import { refreshSession, session } from '../../../shared/api/http.ts'
import type { DocumentItem } from '../types.ts'

function formatFileSize(bytes?: number | string): string {
  if (typeof bytes === 'string') return bytes
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function mapBackendDoc(raw: Record<string, unknown>): DocumentItem {
  const status = (raw.ocrStatus as DocumentItem['ocrStatus']) || 'PENDING'
  const uploadDate = raw.uploadDate as string | undefined
  return {
    id: Number(raw.id),
    title:
      (raw.title as string) ||
      (raw.originalFileName as string) ||
      'Tài liệu không tên',
    fileName:
      (raw.originalFileName as string) ||
      (raw.fileName as string) ||
      'document.pdf',
    fileSize: formatFileSize(raw.fileSize as number | string | undefined),
    ocrStatus: status,
    createdAt: uploadDate
      ? new Date(uploadDate).toLocaleString('vi-VN')
      : (raw.createdAt as string) || '',
    isEmbedded:
      typeof raw.isEmbedded === 'boolean'
        ? raw.isEmbedded
        : status === 'COMPLETED',
    extractedText: raw.extractedText as string | undefined,
  }
}

async function fetchWithAuth(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${env.apiBaseUrl}${path}`
  const makeHeaders = (token: string | null) => ({
    ...init.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  })
  let res = await fetch(url, {
    ...init,
    headers: makeHeaders(session.token),
  })
  if (res.status === 401) {
    const freshToken = await refreshSession().catch(() => null)
    if (freshToken) {
      res = await fetch(url, {
        ...init,
        headers: makeHeaders(freshToken),
      })
    }
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
    }
    throw new Error(
      payload.error || payload.message || `Lỗi máy chủ (${res.status})`,
    )
  }
  return res
}

export const ocrApi = {
  async fetchDocuments(signal?: AbortSignal): Promise<DocumentItem[]> {
    const res = await fetchWithAuth('/documents', { signal })
    const data = await res.json()
    return Array.isArray(data)
      ? data.map((item) => mapBackendDoc(item as Record<string, unknown>))
      : []
  },

  async uploadDocument(
    file: File,
    title: string,
    signal?: AbortSignal,
  ): Promise<DocumentItem> {
    const finalTitle = title.trim() || file.name
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', finalTitle)

    const res = await fetchWithAuth('/documents/upload', {
      method: 'POST',
      body: formData,
      signal,
    })
    const data = (await res.json()) as Record<string, unknown>
    return {
      id: Number(data.id),
      title: finalTitle,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      ocrStatus: (data.ocrStatus as DocumentItem['ocrStatus']) || 'PENDING',
      createdAt: new Date().toLocaleString('vi-VN'),
      isEmbedded: false,
    }
  },

  async fetchDocumentText(id: number, signal?: AbortSignal): Promise<string> {
    const res = await fetchWithAuth(`/documents/${id}/text`, { signal })
    const data = await res.json()
    if (typeof data === 'string') return data
    if (data.text) return data.text as string
    if (data.ocrStatus === 'PENDING' || data.ocrStatus === 'PROCESSING') {
      return '⏳ Tài liệu đang trong hàng đợi xử lý Tesseract OCR. Vui lòng bấm "Làm mới danh sách" sau vài giây...'
    }
    if (data.ocrStatus === 'FAILED') {
      return `❌ Quét OCR thất bại: ${data.ocrError || 'Không thể đọc tệp tin'}`
    }
    return 'Tài liệu không có văn bản trích xuất.'
  },

  async retryOcr(id: number, signal?: AbortSignal): Promise<void> {
    await fetchWithAuth(`/documents/${id}/ocr`, {
      method: 'POST',
      signal,
    })
  },

  async embedDocument(id: number, signal?: AbortSignal): Promise<boolean> {
    await fetchWithAuth(`/documents/${id}/embed`, {
      method: 'POST',
      signal,
    })
    return true
  },
}
