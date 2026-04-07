import { useState } from 'react'
import { Search, X, Lock, Globe, Shield } from 'lucide-react'
import clsx from 'clsx'
import useChatStore from '@/store/chatStore'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { formatConvTime, truncate } from '@/utils/helpers'

const TYPE_ICON = {
  public: Globe,
  private: Lock,
  secret: Shield,
}

export default function GroupList() {
  const [search, setSearch] = useState('')
  const { groups, activeConversation, setActiveConversation, unreadCounts } = useChatStore()

  const filtered = groups.filter((g) =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            className="w-full bg-bg-tertiary border border-border text-text-primary rounded-lg pl-8 pr-8 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-yellow/50 transition-colors"
            placeholder="Search groups..."
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

          return (
            <button
              key={group.id}
              onClick={() => setActiveConversation(group, 'group')}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-3 hover:bg-surface-hover transition-colors text-left',
                isActive && 'bg-surface-active'
              )}
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
                    {formatConvTime(group.last_message_at || group.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={clsx('text-xs truncate', unread > 0 ? 'text-text-secondary font-medium' : 'text-text-muted')}>
                    {group.last_message
                      ? truncate(group.last_message?.content?.text || 'Media', 35)
                      : `${group._count?.members || group.member_count || 0} members`}
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
