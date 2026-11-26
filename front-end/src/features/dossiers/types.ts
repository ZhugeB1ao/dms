import type { DocumentDirection } from '@/features/documents/types.ts'

export interface Dossier {
  id: number
  code: string
  name: string
  year: number
  departmentId: number
  closed: boolean
  documentCount: number
  createdAt: string
}

export interface DossierInput {
  code: string
  name: string
  year: number
}

export interface DossierPage {
  content: Dossier[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface DossierQuery {
  year?: number
  closed?: boolean
  page: number
  size: number
}

export interface DossierDocument {
  id: number
  direction: DocumentDirection
  summary: string
  status: string
  documentTypeName?: string
  docNumber?: string | null
  departmentId: number
  dossierId?: number | null
  createdAt: string
}
