export type OcrStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface DocumentItem {
  id: number
  title: string
  fileName?: string
  fileSize?: string
  ocrStatus: OcrStatus
  extractedText?: string
  createdAt?: string
  isEmbedded?: boolean
}
