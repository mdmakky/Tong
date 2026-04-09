import { useState } from 'react'
import { Search, X, Lock, Globe, Shield, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import useChatStore from '@/store/chatStore'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { groupApi } from '@/lib/apiServices'
import { formatConvTime, truncate } from '@/utils/helpers'

const TYPE_ICON = {
  public: Globe,
  private: Lock,
  secret: Shield,
}

export default function GroupList() {
  const [search, setSearch] = useState('')
  const [busyGroupId, setBusyGroupId] = useState(null)
  const {
    groups,
    activeConversation,
    setActiveConversation,
    removeGroup,
    unreadCounts,
  } = useChatStore()

  const searchNeedle = search.trim().toLowerCase()
  const filtered = groups
    .filter((g) => {
      if (!searchNeedle) return true
      return (
        g.name?.toLowerCase().includes(searchNeedle) ||
        g.unique_group_id?.toLowerCase().includes(searchNeedle)
      )
    })
    .sort((a, b) => {
      // Sort by last message time (most recent first)
      const aTime = new Date(a.last_message_at || a.last_message?.created_at || a.created_at).getTime()
      const bTime = new Date(b.last_message_at || b.last_message?.created_at || b.created_at).getTime()
      return bTime - aTime
    })

  const handleDeleteGroupChat = async (group) => {
    if (!group?.id || busyGroupId) return

    const isOwner = group.my_role === 'owner'
    const confirmed = window.confirm(
      isOwner
        ? `Delete group \"${group.name || 'this group'}\" for everyone? This cannot be undone.`
        : `Leave and remove \"${group.name || 'this group'}\" from your chats?`
    )

    if (!confirmed) return

    setBusyGroupId(group.id)
    try {
      if (isOwner) {
        await groupApi.delete(group.id)
        toast.success('Group deleted')
      } else {
        await groupApi.leave(group.id)
        toast.success('Group chat removed')
      }

      removeGroup(group.id)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove group chat')
    } finally {
      setBusyGroupId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            className="w-full bg-bg-tertiary border border-border text-text-primary rounded-lg pl-8 pr-8 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-yellow/50 transition-colors"
            placeholder="Search groups or group ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-text-muted text-sm text-center py-8">No groups</p>
        )}
        {filtered.map((group) => {
          const TypeIcon = TYPE_ICON[group.type] || Globe
          const unread = unreadCounts[group.id] || 0
          const isActive = activeConversation?.id === group.id
          const isBusy = busyGroupId === group.id
          const groupIdLabel = group.unique_group_id ? `@${group.unique_group_id}` : null

          return (
            <div
              key={group.id}
              className={clsx(
                'w-full flex items-center gap-2 px-2 py-2 hover:bg-surface-hover transition-colors',
                isActive && 'bg-surface-active'
              )}
            >
              <button
                onClick={() => setActiveConversation(group, 'group')}
                className="flex-1 min-w-0 flex items-center gap-3 px-1 py-1 text-left"
              >
                <Avatar
                  src={group.avatar_url}
                  name={group.name}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate">{group.name}</span>
                      <TypeIcon className="w-3 h-3 text-text-muted flex-shrink-0" />
                    </div>
                    <span className="text-xs text-text-muted flex-shrink-0 ml-2">
                      {formatConvTime(group.last_message_at || group.last_message?.created_at || group.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={clsx('text-xs truncate', unread > 0 ? 'text-text-secondary font-medium' : 'text-text-muted')}>
                      {groupIdLabel
                        ? `${groupIdLabel} · `
                        : ''}
                      {group.last_message
                        ? truncate(group.last_message?.content?.text || 'Media', 35)
                        : `${group._count?.members || group.member_count || 0} members`}
                    </span>
                    {unread > 0 && <Badge count={unread} className="ml-2 flex-shrink-0" />}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteGroupChat(group)
                }}
                disabled={isBusy}
                className={clsx(
                  'p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0',
                  isBusy && 'opacity-50 cursor-not-allowed'
                )}
                title={group.my_role === 'owner' ? 'Delete group' : 'Leave and remove group chat'}
                aria-label={group.my_role === 'owner' ? 'Delete group' : 'Leave and remove group chat'}
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
