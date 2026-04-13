import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import useSocketEvents from '@/hooks/useSocketEvents'
import { conversationApi, groupApi } from '@/lib/apiServices'
import Sidebar from '@/components/sidebar/Sidebar'
import ChatWindow from '@/components/chat/ChatWindow'
import InfoPanel from '@/components/infopanel/InfoPanel'
import EmptyChatState from '@/components/chat/EmptyChatState'
import useSeo from '@/hooks/useSeo'

export default function ChatLayout() {
  const {
    activeConversation,
    showInfoPanel,
    toggleInfoPanel,
    setConversations,
    setGroups,
    socket,
    updatePresence,
  } = useChatStore()
  const { user } = useAuthStore()

  useSeo({
    title: 'App',
    description: 'Private messaging workspace for Tong Chat users.',
    canonicalPath: '/app',
    noIndex: true,
  })

  // Register all socket events
  useSocketEvents()

  // Fetch conversations
  const { data: convsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.list().then((r) => r.data.data),
  })

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupApi.list().then((r) => r.data.data),
  })

  useEffect(() => {
    if (convsData) setConversations(convsData)
  }, [convsData])

  useEffect(() => {
    if (groupsData) setGroups(groupsData)
  }, [groupsData])

  useEffect(() => {
    if (!socket || !user?.id || !Array.isArray(convsData) || convsData.length === 0) return

    const userIds = [...new Set(
      convsData
        .map((conv) => conv?.other_user?.id)
        .filter(Boolean)
    )]

    if (userIds.length === 0) return

    socket.emit('get_presence', { user_ids: userIds }, (payload) => {
      const presence = payload?.presence
      if (!presence || typeof presence !== 'object') return

      Object.entries(presence).forEach(([targetUserId, meta]) => {
        if (!meta) return
        updatePresence(targetUserId, meta.status, meta.last_seen)
      })
    })
  }, [socket, user?.id, convsData, updatePresence])

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-bg-primary">
      {/* Left sidebar — full-width on mobile, 360px on desktop */}
      <div
        className={clsx(
          'flex-shrink-0 flex flex-col border-r border-border',
          'w-full md:w-[360px]',
          activeConversation ? 'hidden md:flex' : 'flex'
        )}
      >
        <Sidebar />
      </div>

      {/* Center — hidden on mobile when no conversation selected */}
      <div
        className={clsx(
          'flex-1 flex flex-col overflow-hidden',
          !activeConversation && 'hidden md:flex'
        )}
      >
        {activeConversation ? (
          <ChatWindow />
        ) : (
          <EmptyChatState />
        )}
      </div>

      {/* Right info panel — hidden on mobile, sidebar on desktop */}
      {activeConversation && showInfoPanel && (
        <div className="hidden md:flex w-[320px] flex-shrink-0 flex-col border-l border-border">
          <InfoPanel />
        </div>
      )}

      {/* Mobile info panel — full-height sheet overlay */}
      {activeConversation && showInfoPanel && (
        <div
          className="md:hidden fixed inset-0 z-50 flex justify-end"
          onClick={toggleInfoPanel}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-[300px] h-full bg-bg-secondary flex flex-col overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <InfoPanel />
          </div>
        </div>
      )}
    </div>
  )
}
