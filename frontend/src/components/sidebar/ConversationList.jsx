import { useState } from 'react'
import { Search, X, Pin, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { conversationApi } from '@/lib/apiServices'
import { formatConvTime, truncate } from '@/utils/helpers'

export default function ConversationList() {
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    removeConversation,
    unreadCounts,
    presenceMap,
    pinnedConversations,
  } = useChatStore()
  const { user } = useAuthStore()

  const filtered = conversations
    .filter((conv) => {
      if (!search) return true
      const other = getOtherParticipant(conv, user?.id)
      return other?.display_name?.toLowerCase().includes(search.toLowerCase())
    })
    .sort((a, b) => {
      const aPinned = pinnedConversations.includes(a.id)
      const bPinned = pinnedConversations.includes(b.id)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      
      // Sort by last message time (most recent first)
      const aTime = new Date(a.last_message_at || a.last_message?.created_at || a.created_at).getTime()
      const bTime = new Date(b.last_message_at || b.last_message?.created_at || b.created_at).getTime()
      return bTime - aTime
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

  async function handleDeleteConversation(convId, displayName) {
    if (!convId || deletingId) return
    const confirmed = window.confirm(`Delete whole chat with ${displayName || 'this user'} for you?`)
    if (!confirmed) return
    setDeletingId(convId)
    try {
      await conversationApi.delete(convId)
      removeConversation(convId)
      toast.success('Conversation deleted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete conversation')
    } finally {
      setDeletingId(null)
    }
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
          const isDeleting = deletingId === conv.id
          const isPinned = pinnedConversations.includes(conv.id)

          return (
            <div
              key={conv.id}
              className={clsx(
                'w-full flex items-center gap-2 px-2 py-2 hover:bg-surface-hover transition-colors',
                isActive && 'bg-surface-active'
              )}
            >
              <button
                onClick={() => setActiveConversation(conv, conv.type)}
                className="flex-1 min-w-0 flex items-center gap-3 px-1 py-1 text-left"
              >
                <Avatar
                  src={other?.avatar_url}
                  name={other?.display_name || 'User'}
                  size="md"
                  status={status}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={clsx(
                      'text-sm truncate',
                      unread > 0 ? 'font-bold text-text-primary' : 'font-medium text-text-primary'
                    )}>
                      {other?.display_name || 'Unknown'}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {isPinned && <Pin className="w-3 h-3 text-accent-yellow" />}
                      <span className="text-xs text-text-muted">
                        {formatConvTime(conv.last_message_at || conv.last_message?.created_at || conv.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={clsx(
                      'text-xs truncate',
                      unread > 0 ? 'text-text-primary font-semibold' : 'text-text-muted'
                    )}>
                      {getLastMessage(conv)}
                    </span>
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      {unread > 0 && <Badge count={unread} />}
                      {/* Messenger-style: show receiver's tiny avatar when your last message is seen */}
                      {unread === 0 &&
                        conv.last_message?.sender_id === user?.id &&
                        conv.last_message?.status === 'read' &&
                        conv.last_message?.read_by && (
                        <img
                          src={conv.last_message.read_by.reader_avatar_url || other?.avatar_url}
                          alt="Seen"
                          className="w-4 h-4 rounded-full object-cover ring-1 ring-bg-primary"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id, other?.display_name) }}
                disabled={isDeleting}
                className={clsx(
                  'p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0',
                  isDeleting && 'opacity-50 cursor-not-allowed'
                )}
                title={isDeleting ? 'Deleting...' : 'Delete conversation'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
