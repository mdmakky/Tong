import clsx from 'clsx'
import useChatStore from '@/store/chatStore'

export default function ReplyPreview({ messageId, isOwn, conversationId }) {
  const { messages } = useChatStore()

  // messageId may be a populated object (from API) or a plain ID string
  let original = null
  if (messageId && typeof messageId === 'object') {
    original = messageId
  } else if (messageId) {
    const convMessages = messages[conversationId] || []
    original = convMessages.find((m) => m._id === messageId || m.id === messageId)
  }

  if (!original) return null

  const text = original.content?.text || `[${original.message_type || 'media'}]`
  const senderName = original.sender?.display_name || 'Unknown'

  return (
    <div
      className={clsx(
        'flex items-start gap-2 mb-1 rounded-xl px-3 py-2 max-w-full border-l-2 border-accent-yellow/70',
        isOwn ? 'bg-black/20' : 'bg-bg-primary/30'
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-accent-yellow truncate">{senderName}</p>
        <p className="text-xs text-text-muted truncate max-w-[200px]">{text}</p>
      </div>
    </div>
  )
}
