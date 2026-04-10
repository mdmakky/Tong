import { Phone, Video, Search, MoreVertical, ChevronRight, ArrowLeft, Pin } from 'lucide-react'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import Avatar from '@/components/ui/Avatar'
import { formatLastSeen } from '@/utils/helpers'

export default function ChatHeader() {
  const { activeConversation, activeType, presenceMap, typingUsers, toggleInfoPanel, showInfoPanel, setActiveConversation, pinnedConversations, pinnedGroups, togglePinConversation, togglePinGroup, nicknames } = useChatStore()
  const { user } = useAuthStore()

  if (!activeConversation) return null

  const isGroup = activeType === 'group'
  const convId = activeConversation.id

  // For direct chats, find the other participant
  let displayName, avatarUrl, subtitle, status

  if (isGroup) {
    displayName = activeConversation.name
    avatarUrl = activeConversation.avatar_url
    subtitle = `${activeConversation._count?.members || activeConversation.member_count || 0} members`
    status = null
  } else {
    const other =
      activeConversation.other_user ||
      (activeConversation.participant_1 === user?.id
        ? activeConversation.user2
        : activeConversation.user1) ||
      null

    // Use nickname if available, otherwise use real name
    const nickname = nicknames[convId]
    displayName = nickname || other?.display_name || 'User'
    avatarUrl = other?.avatar_url
    const presence = other ? presenceMap[other.id] : null
    status = presence?.status || other?.online_status || 'offline'

    const typingList = (typingUsers[convId] || []).filter((u) => u.user_id !== user?.id)
    if (typingList.length > 0) {
      subtitle = 'typing...'
    } else if (status === 'online') {
      subtitle = 'Online'
    } else if (other?.last_seen) {
      subtitle = `Last seen ${formatLastSeen(other.last_seen)}`
    } else {
      subtitle = 'Offline'
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border bg-bg-primary">
      {/* Back button (mobile only) */}
      <button
        onClick={() => setActiveConversation(null)}
        className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors flex-shrink-0"
        title="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Avatar + info */}
      <button onClick={toggleInfoPanel} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <Avatar src={avatarUrl} name={displayName} size="md" status={!isGroup ? status : undefined} />
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary truncate">{displayName}</h2>
          <p className={`text-xs truncate ${subtitle === 'typing...' ? 'text-accent-yellow' : 'text-text-secondary'}`}>
            {subtitle}
          </p>
        </div>
      </button>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button className="icon-btn" title="Voice call">
          <Phone className="w-5 h-5" />
        </button>
        <button className="icon-btn" title="Video call">
          <Video className="w-5 h-5" />
        </button>
        <button className="icon-btn" title="Search in conversation">
          <Search className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            if (isGroup) {
              togglePinGroup(convId)
            } else {
              togglePinConversation(convId)
            }
          }}
          className={`icon-btn ${(isGroup ? pinnedGroups : pinnedConversations).includes(convId) ? 'text-accent-yellow' : ''}`}
          title={`${(isGroup ? pinnedGroups : pinnedConversations).includes(convId) ? 'Unpin' : 'Pin'} ${isGroup ? 'group' : 'conversation'}`}
        >
          <Pin className="w-5 h-5" />
        </button>
        <button
          onClick={toggleInfoPanel}
          className={`icon-btn ${showInfoPanel ? 'text-accent-yellow bg-surface-active' : ''}`}
          title="Info panel"
        >
          <ChevronRight className={`w-5 h-5 transition-transform ${showInfoPanel ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  )
}
