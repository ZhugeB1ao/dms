import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  Conversation,
  Message,
  SidePanelTab,
  SourceCitation,
} from '../types.ts'
import { chatApi } from '../api/chatApi.ts'
import { ChatContext } from './useChat.ts'

export default function ChatProvider({ children }: { children: ReactNode }) {
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('hidden')
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sources, setSources] = useState<SourceCitation[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [currentMessages, setCurrentMessages] = useState<Message[]>([])

  const streamAbortRef = useRef<AbortController | null>(null)
  useEffect(() => () => streamAbortRef.current?.abort(), [])

  function toggleSidePanel(
    defaultTab: Exclude<SidePanelTab, 'hidden'> = 'sources',
  ) {
    setSidePanelTab((prev) => (prev === defaultTab ? 'hidden' : defaultTab))
  }

  function openSourceDetail(index = 0, msgSources?: SourceCitation[]) {
    if (msgSources && msgSources.length > 0) {
      setSources(msgSources)
    }
    setSelectedSourceIndex(index)
    setSidePanelTab('detail')
  }

  function selectConversation(id: string) {
    streamAbortRef.current?.abort()
    setActiveId(id)
    const conv = conversations.find((c) => c.id === id)
    setCurrentMessages(conv?.messages || [])
    const lastWithSources = conv?.messages
      .slice()
      .reverse()
      .find((m) => m.sources && m.sources.length > 0)
    if (lastWithSources?.sources) {
      setSources(lastWithSources.sources)
    }
  }

  function startNewChat() {
    streamAbortRef.current?.abort()
    setActiveId(null)
    setCurrentMessages([])
    setSidePanelTab('hidden')
  }

  async function sendMessage(content: string) {
    streamAbortRef.current?.abort()
    const controller = new AbortController()
    streamAbortRef.current = controller

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    }
    const botMsgId = `assistant-${Date.now()}`
    const botPlaceholder: Message = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      sources: [],
    }
    const updatedMessages = [...currentMessages, userMsg, botPlaceholder]
    setCurrentMessages(updatedMessages)
    setIsLoading(true)

    let currentChatId = activeId
    if (!currentChatId) {
      currentChatId = `chat-${Date.now()}`
      setActiveId(currentChatId)
      const newConv: Conversation = {
        id: currentChatId,
        title: content.slice(0, 30),
        messages: updatedMessages,
      }
      setConversations((prev) => [newConv, ...prev])
    }

    let accumulatedContent = ''
    let latestSources: SourceCitation[] = []

    try {
      await chatApi.askQuestionStream(
        content,
        {
          onSources: (incomingSources) => {
            latestSources = incomingSources
            setSources(incomingSources)
            setCurrentMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMsgId
                  ? { ...msg, sources: incomingSources }
                  : msg,
              ),
            )
          },
          onDelta: (deltaText) => {
            accumulatedContent += deltaText
            setCurrentMessages((prev) =>
              prev.map((msg) =>
                msg.id === botMsgId
                  ? { ...msg, content: accumulatedContent }
                  : msg,
              ),
            )
          },
        },
        controller.signal,
      )

      if (controller.signal.aborted) return

      const finalBotMsg: Message = {
        id: botMsgId,
        role: 'assistant',
        content: accumulatedContent,
        sources: latestSources,
      }
      const finalMessages = [...currentMessages, userMsg, finalBotMsg]
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentChatId ? { ...c, messages: finalMessages } : c,
        ),
      )
    } catch (err) {
      if (controller.signal.aborted) return
      const errMsg = err instanceof Error ? err.message : 'Something went wrong'
      const errorMessages = updatedMessages.map((msg) =>
        msg.id === botMsgId
          ? { ...msg, content: `An error occurred: ${errMsg}` }
          : msg,
      )
      setCurrentMessages(errorMessages)
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentChatId ? { ...c, messages: errorMessages } : c,
        ),
      )
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }

  return (
    <ChatContext
      value={{
        sidePanelTab,
        setSidePanelTab,
        toggleSidePanel,
        selectedSourceIndex,
        setSelectedSourceIndex,
        openSourceDetail,
        conversations,
        activeId,
        messages: currentMessages,
        isLoading,
        sources,
        selectConversation,
        startNewChat,
        sendMessage,
      }}
    >
      {children}
    </ChatContext>
  )
}
