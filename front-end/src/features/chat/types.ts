export interface SourceCitation {
  id: string
  type: 'link' | 'document'
  title: string
  description?: string
  url?: string
  fileType?: string
  fileSize?: string
  pageCount?: number
  previewText?: string
  text?: string
  score?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  sources?: SourceCitation[]
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt?: string
}

export type SidePanelTab = 'hidden' | 'history' | 'sources' | 'detail'
