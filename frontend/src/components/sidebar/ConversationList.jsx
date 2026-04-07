import { useState } from 'react'
import { Search, X } from 'lucide-react'
import clsx from 'clsx'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { formatConvTime, truncate } from '@/utils/helpers'

export default function ConversationList() {
  const [search, setSearch] = useState('')
  const { conversations, activeConversation, setActiveConversation, unreadCounts, presenceMap } = useChatStore()
  const { user } = useAuthStore()

  const filtered = conversations.filter((conv) => {
    if (!search) return true
    const other = getOtherParticipant(conv, user?.id)
    return other?.display_name?.toLowerCase().includes(search.toLowerCase())
  })

  function getOtherParticipant(conv, myId) {
    // Enriched list format (getConversations returns other_user directly)
    if (conv.other_user) return conv.other_user
    // Raw Prisma format (createConversation returns user1/user2)
    if (conv.user1 && conv.user2) {
      return conv.participant_1 === myId ? conv.user2 : conv.user1
    }
    return null
  }

  function getLastMessage(conv) {
    if (!conv.last_message) return 'Start a conversation'
    const msg = conv.last_message
    if (msg.is_deleted_for_all) return 'Message deleted'
    if (msg.message_type === 'image') return '📷 Photo'
    if (msg.message_type === 'video') return '🎥 Video'
    if (msg.message_type === 'audio') return '🎤 Voice message'
    if (msg.message_type === 'file') return `📎 ${msg.content?.file_name || 'File'}`
    return truncate(msg.content?.text || '', 35)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            className="w-full bg-bg-tertiary border border-border text-text-primary rounded-lg pl-8 pr-8 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-yellow/50 transition-colors"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-text-muted text-sm text-center py-8">No conversations</p>
        )}
        {filtered.map((conv) => {
          const other = getOtherParticipant(conv, user?.id)
          const presence = other ? presenceMap[other.id] : null
          const status = presence?.status || (other?.online_status ?? 'offline')
          const unread = unreadCounts[conv.id] || 0
          const isActive = activeConversation?.id === conv.id

          return (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv, conv.type)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-3 hover:bg-surface-hover transition-colors text-left',
                isActive && 'bg-surface-active'
              )}
            >
              <Avatar
                src={other?.avatar_url}
                name={other?.display_name || 'User'}
                size="md"
                status={status}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {other?.display_name || 'Unknown'}
                  </span>
                  <span className="text-xs text-text-muted flex-shrink-0 ml-2">
                    {formatConvTime(conv.last_message_at || conv.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={clsx(
                    'text-xs truncate',
                    unread > 0 ? 'text-text-secondary font-medium' : 'text-text-muted'
                  )}>
                    {getLastMessage(conv)}
                  </span>
                  {unread > 0 && <Badge count={unread} className="ml-2 flex-shrink-0" />}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
