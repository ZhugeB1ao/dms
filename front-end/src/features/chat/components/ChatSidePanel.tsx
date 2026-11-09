import {
  BookIcon,
  DocumentIcon,
  ExternalLinkIcon,
  EyeIcon,
} from '../../../shared/components/Icons.tsx'
import { useChat } from '../context/useChat.ts'

export function ChatSidePanel() {
  const {
    sidePanelTab,
    setSidePanelTab,
    conversations,
    activeId,
    selectConversation,
    sources,
    selectedSourceIndex,
    setSelectedSourceIndex,
  } = useChat()

  const selectedSource = sources[selectedSourceIndex] || sources[0]

  return (
    <aside
      aria-label="Conversation and reference panel"
      className="flex h-full w-[340px] shrink-0 flex-col border-l border-white/10 bg-[#0c0c0c] text-[#ECECEC] select-none"
    >
      {/* Header Row: Tab Switcher */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 p-2.5 shrink-0">
        <div className="flex flex-1 gap-1 rounded-xl bg-[#212121] p-1 text-xs">
          <button
            type="button"
            onClick={() => setSidePanelTab('history')}
            className={`flex-1 rounded-lg py-1.5 px-2 font-medium transition-colors ${
              sidePanelTab === 'history'
                ? 'bg-black/80 text-white shadow-sm'
                : 'text-[#8e8e8e] hover:text-white'
            }`}
          >
            History ({conversations.length})
          </button>
          <button
            type="button"
            onClick={() => setSidePanelTab('sources')}
            className={`flex-1 rounded-lg py-1.5 px-2 font-medium flex items-center justify-center gap-1 transition-colors ${
              sidePanelTab === 'sources'
                ? 'bg-black/80 text-white shadow-sm'
                : 'text-[#8e8e8e] hover:text-white'
            }`}
          >
            <BookIcon className="w-3.5 h-3.5" />
            <span>Sources ({sources.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSidePanelTab('detail')}
            className={`flex-1 rounded-lg py-1.5 px-2 font-medium flex items-center justify-center gap-1 transition-colors ${
              sidePanelTab === 'detail'
                ? 'bg-black/80 text-white shadow-sm'
                : 'text-[#8e8e8e] hover:text-white'
            }`}
          >
            <EyeIcon className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>
        </div>

        <button
          type="button"
          aria-label="Close side panel"
          onClick={() => setSidePanelTab('hidden')}
          className="rounded-lg p-1.5 text-[#8e8e8e] hover:bg-white/5 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {sidePanelTab === 'history' &&
          conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => selectConversation(conv.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                conv.id === activeId
                  ? 'bg-[#242424] font-medium text-white'
                  : 'text-[#bdbdbd] hover:bg-[#1b1b1b] hover:text-white'
              }`}
            >
              <span className="block truncate">{conv.title}</span>
            </button>
          ))}

        {sidePanelTab === 'sources' &&
          sources.map((source, idx) => (
            <div
              key={source.id}
              onClick={() => {
                setSelectedSourceIndex(idx)
                setSidePanelTab('detail')
              }}
              className="p-2.5 rounded-xl bg-[#212121]/60 hover:bg-[#212121] border border-white/5 hover:border-white/15 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[#55b9ff] bg-[#1e3c66]/40 border border-[#55b9ff]/20">
                  <DocumentIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-[13px] font-medium text-white truncate group-hover:text-[#55b9ff] transition-colors">
                      {source.title}
                    </h4>
                    {source.score !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#55b9ff] font-mono shrink-0">
                        {(source.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#8e8e8e] mt-0.5 line-clamp-2">
                    {source.text ||
                      source.description ||
                      'View reference content'}
                  </p>
                </div>
              </div>
            </div>
          ))}

        {sidePanelTab === 'detail' && selectedSource && (
          <div className="space-y-4 text-left select-text">
            <div className="rounded-xl bg-[#212121]/70 border border-white/10 overflow-hidden shadow-sm flex flex-col">
              <div className="p-3 bg-[#1e232d]/80 border-b border-white/5 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[#55b9ff] bg-[#1e3c66]/50 border border-[#55b9ff]/20">
                    <DocumentIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-[13px] font-semibold text-white truncate">
                        {selectedSource.title}
                      </h4>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#1e3c66] text-[#55b9ff] font-semibold shrink-0">
                        {selectedSource.fileType || 'PDF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8e8e8e] truncate">
                      {selectedSource.description ||
                        'Hoa Sen University documents'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-black/50 space-y-3 font-sans text-xs leading-relaxed text-[#b4b4b4]">
                <div className="border-b border-white/5 pb-2">
                  <h5 className="text-[12px] font-semibold text-[#55b9ff] tracking-tight">
                    Reference excerpt
                  </h5>
                </div>
                <p className="text-[#e2e2e2] bg-white/5 p-2.5 rounded-lg border border-white/5 leading-relaxed whitespace-pre-wrap">
                  {selectedSource.text ||
                    selectedSource.previewText ||
                    'No preview available.'}
                </p>
              </div>

              <div className="p-2.5 bg-[#171717] border-t border-white/5 flex items-center justify-between text-[11px] text-[#8e8e8e]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10A37F]" />
                  Verified by HSU RAG
                </span>
                <button
                  type="button"
                  className="text-[#55b9ff] hover:underline flex items-center gap-1 font-medium"
                  onClick={() => setSidePanelTab('sources')}
                >
                  <span>View another source</span>
                  <ExternalLinkIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="p-3 border-t border-white/5 flex items-center justify-between text-xs text-[#8e8e8e] bg-black shrink-0">
        <span className="truncate text-[11px]">
          {sources.length}&nbsp;linked documents
        </span>
      </div>
    </aside>
  )
}
