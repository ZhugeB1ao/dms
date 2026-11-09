import ChatProvider from '../context/ChatProvider.tsx'
import { useChat } from '../context/useChat.ts'
import { GreetingView } from '../components/GreetingView.tsx'
import { ChatArea } from '../components/ChatArea.tsx'
import { ChatInput } from '../components/ChatInput.tsx'
import { ChatSidePanel } from '../components/ChatSidePanel.tsx'

function ChatWorkspace() {
  const {
    messages,
    isLoading,
    sendMessage,
    startNewChat,
    conversations,
    sources,
    sidePanelTab,
    toggleSidePanel,
  } = useChat()

  return (
    <section
      aria-label="AI Assistant"
      className="flex h-[calc(100dvh-72px)] w-full overflow-hidden border-t border-[#292929] bg-black"
    >
      {/* Main column: sub-header + chat area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-2 rounded-lg bg-[#212121] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2c2c2c]"
          >
            <span>+ New chat</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSidePanel('history')}
              aria-pressed={sidePanelTab === 'history'}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                sidePanelTab === 'history'
                  ? 'bg-[#55b9ff]/20 text-[#55b9ff] border border-[#55b9ff]/40'
                  : 'bg-[#212121] text-[#bdbdbd] hover:text-white'
              }`}
            >
              History ({conversations.length})
            </button>
            <button
              type="button"
              onClick={() => toggleSidePanel('sources')}
              aria-pressed={
                sidePanelTab === 'sources' || sidePanelTab === 'detail'
              }
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                sidePanelTab === 'sources' || sidePanelTab === 'detail'
                  ? 'bg-[#55b9ff]/20 text-[#55b9ff] border border-[#55b9ff]/40'
                  : 'bg-[#212121] text-[#bdbdbd] hover:text-white'
              }`}
            >
              Sources ({sources.length})
            </button>
          </div>
        </div>

        {messages.length === 0 ? (
          <GreetingView onSend={sendMessage} disabled={isLoading} />
        ) : (
          <>
            <ChatArea messages={messages} isLoading={isLoading} />
            <footer className="flex w-full shrink-0 flex-col items-center px-4 pt-1 pb-3">
              <ChatInput
                onSend={sendMessage}
                position="bottom"
                disabled={isLoading}
              />
            </footer>
          </>
        )}
      </div>

      {/* Right column: opens and closes by context (History / Sources / Details) */}
      {sidePanelTab !== 'hidden' && <ChatSidePanel />}
    </section>
  )
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatWorkspace />
    </ChatProvider>
  )
}
