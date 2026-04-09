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

export default function ChatLayout() {
  const { activeConversation, showInfoPanel, setConversations, setGroups } = useChatStore()

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary">
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

      {/* Right info panel — hidden on mobile */}
      {activeConversation && showInfoPanel && (
        <div className="hidden md:flex w-[320px] flex-shrink-0 flex-col border-l border-border">
          <InfoPanel />
        </div>
      )}
    </div>
  )
}
