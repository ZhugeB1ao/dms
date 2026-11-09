import {
  CopyIcon,
  ThumbsDownIcon,
  ShareIcon,
  RegenerateIcon,
  MoreDotsIcon,
} from '../../../shared/components/Icons.tsx'

export function MessageActions() {
  return (
    <div className="flex items-center gap-3 pt-1 text-[#8f8f8f]">
      <button
        aria-label="Copy"
        className="hover:text-white transition-colors"
        type="button"
      >
        <CopyIcon />
      </button>
      <button
        aria-label="Dislike"
        className="hover:text-white transition-colors"
        type="button"
      >
        <ThumbsDownIcon />
      </button>
      <button
        aria-label="Share"
        className="hover:text-white transition-colors"
        type="button"
      >
        <ShareIcon />
      </button>
      <button
        aria-label="Regenerate response"
        className="hover:text-white transition-colors"
        type="button"
      >
        <RegenerateIcon />
      </button>
      <button
        aria-label="More options"
        className="hover:text-white transition-colors"
        type="button"
      >
        <MoreDotsIcon />
      </button>
    </div>
  )
}
