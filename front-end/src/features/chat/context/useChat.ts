import { createContext, useContext } from 'react'
import type {
  Conversation,
  Message,
  SidePanelTab,
  SourceCitation,
} from '../types.ts'

export interface ChatContextValue {
  sidePanelTab: SidePanelTab
  setSidePanelTab: (tab: SidePanelTab) => void
  toggleSidePanel: (defaultTab?: Exclude<SidePanelTab, 'hidden'>) => void
  selectedSourceIndex: number
  setSelectedSourceIndex: (idx: number) => void
  openSourceDetail: (index?: number, msgSources?: SourceCitation[]) => void
  conversations: Conversation[]
  activeId: string | null
  messages: Message[]
  isLoading: boolean
  sources: SourceCitation[]
  selectConversation: (id: string) => void
  startNewChat: () => void
  sendMessage: (content: string) => Promise<void>
}

export const ChatContext = createContext<ChatContextValue | null>(null)

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within a ChatProvider')
  return ctx
}
