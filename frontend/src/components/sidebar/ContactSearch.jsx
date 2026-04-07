import { useState } from 'react'
import { Search, UserPlus, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { userApi, conversationApi } from '@/lib/apiServices'
import Avatar from '@/components/ui/Avatar'
import useChatStore from '@/store/chatStore'

export default function ContactSearch() {
  const [query, setQuery] = useState('')
  const { setActiveConversation, upsertConversation } = useChatStore()
  const [starting, setStarting] = useState(null)

  const { data, isFetching } = useQuery({
    queryKey: ['user-search', query],
    queryFn: () => userApi.search(query).then((r) => r.data.data),
    enabled: query.trim().length >= 2,
    staleTime: 5000,
  })

  const startChat = async (userId) => {
    setStarting(userId)
    try {
      const { data: res } = await conversationApi.create(userId)
      const conv = res.data
      upsertConversation(conv)
      setActiveConversation(conv, conv.type)
    } catch (err) {
      toast.error('Could not start conversation')
    } finally {
      setStarting(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            className="w-full bg-bg-tertiary border border-border text-text-primary rounded-lg pl-8 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-yellow/50 transition-colors"
            placeholder="Search by name or @username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {query.length < 2 && (
          <p className="text-text-muted text-sm text-center py-8">Type at least 2 characters to search</p>
        )}
        {isFetching && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        )}
        {!isFetching && data?.length === 0 && query.length >= 2 && (
          <p className="text-text-muted text-sm text-center py-8">No users found</p>
        )}
        {data?.map((u) => (
          <div key={u.id} className="flex items-center gap-3 py-2.5">
            <Avatar src={u.avatar_url} name={u.display_name} size="md" status={u.online_status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{u.display_name}</p>
              <p className="text-xs text-text-muted">@{u.username}</p>
            </div>
            <button
              onClick={() => startChat(u.id)}
              disabled={starting === u.id}
              className="p-2 rounded-lg text-text-muted hover:text-accent-yellow hover:bg-surface-hover transition-colors"
              title="Start chat"
            >
              {starting === u.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
