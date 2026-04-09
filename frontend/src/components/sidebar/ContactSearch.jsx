import { useEffect, useState } from 'react'
import { Search, UserPlus, Loader2, Users, Check } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { userApi, conversationApi, groupApi } from '@/lib/apiServices'
import Avatar from '@/components/ui/Avatar'
import useChatStore from '@/store/chatStore'

export default function ContactSearch() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const { setActiveConversation, upsertConversation, upsertGroup, setSidebarTab } = useChatStore()
  const [starting, setStarting] = useState(null)
  const [joiningGroupId, setJoiningGroupId] = useState(null)
  const trimmedQuery = query.trim()

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(trimmedQuery)
    }, 250)

    return () => clearTimeout(handle)
  }, [trimmedQuery])

  const {
    data: usersData,
    isFetching: isFetchingUsers,
    isError: usersError,
    error: usersSearchError,
  } = useQuery({
    queryKey: ['user-search', debouncedQuery],
    queryFn: () => userApi.search(debouncedQuery).then((r) => r.data.data?.users ?? r.data.data ?? []),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5000,
    retry: 1,
  })

  const {
    data: groupsData,
    isFetching: isFetchingGroups,
    isError: groupsError,
    error: groupsSearchError,
  } = useQuery({
    queryKey: ['public-group-search', debouncedQuery],
    queryFn: () => groupApi.searchPublic(debouncedQuery).then((r) => r.data.data?.groups ?? []),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5000,
    retry: 1,
  })

  const users = (Array.isArray(usersData) ? usersData : []).filter((u) => u && u.id)
  const groups = (Array.isArray(groupsData) ? groupsData : []).filter((g) => g && g.id)
  const isFetching = isFetchingUsers || isFetchingGroups
  const showSearchError = debouncedQuery.length >= 2 && usersError && groupsError

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

  const handleGroupAction = async (group) => {
    const isJoined = Boolean(group.is_joined || group.my_role)

    setJoiningGroupId(group.id)
    try {
      if (isJoined) {
        upsertGroup(group)
        setActiveConversation(group, 'group')
        setSidebarTab('groups')
        return
      }

      const { data: res } = await groupApi.joinPublic(group.id)
      const joinedGroup = res.data
      upsertGroup(joinedGroup)
      setActiveConversation(joinedGroup, 'group')
      setSidebarTab('groups')
      toast.success(`Joined ${joinedGroup.name}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not join group')
    } finally {
      setJoiningGroupId(null)
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
            placeholder="Search people and public groups..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {trimmedQuery.length < 2 && (
          <p className="text-text-muted text-sm text-center py-8">Type at least 2 characters to search</p>
        )}
        {isFetching && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        )}

        {showSearchError && (
          <p className="text-red-400 text-sm text-center py-8">
            {usersSearchError?.response?.data?.message || groupsSearchError?.response?.data?.message || 'Search failed. Please try again.'}
          </p>
        )}

        {!isFetching && !showSearchError && users.length === 0 && groups.length === 0 && debouncedQuery.length >= 2 && (
          <p className="text-text-muted text-sm text-center py-8">No users found</p>
        )}

        {users.length > 0 && (
          <p className="text-[11px] uppercase tracking-wide text-text-muted px-1 pt-2 pb-1">People</p>
        )}
        {users.map((u) => {
          const displayName = u.display_name || u.username || 'Unknown user'
          const username = u.username || 'unknown'

          return (
          <div key={u.id} className="flex items-center gap-3 py-2.5">
            <Avatar src={u.avatar_url} name={displayName} size="md" status={u.online_status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{displayName}</p>
              <p className="text-xs text-text-muted">@{username}</p>
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
          )
        })}

        {groups.length > 0 && (
          <p className="text-[11px] uppercase tracking-wide text-text-muted px-1 pt-3 pb-1">Public groups</p>
        )}
        {groups.map((group) => {
          const memberCount = group.member_count || group._count?.members || 0
          const isJoined = Boolean(group.is_joined || group.my_role)
          const isJoining = joiningGroupId === group.id

          return (
            <div key={group.id} className="flex items-center gap-3 py-2.5">
              <Avatar src={group.avatar_url} name={group.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{group.name}</p>
                <p className="text-xs text-text-muted truncate">
                  {group.description || `${memberCount} members`}
                </p>
              </div>
              <button
                onClick={() => handleGroupAction(group)}
                disabled={isJoining}
                className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-text-secondary hover:text-text-primary hover:border-accent-yellow/40 hover:bg-surface-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                title={isJoined ? 'Open group chat' : 'Join group'}
              >
                {isJoining ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isJoined ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Open
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5" />
                    Join
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
