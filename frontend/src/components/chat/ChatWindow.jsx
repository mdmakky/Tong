import { useEffect, useRef, useState, useCallback } from 'react'
import { Virtuoso } from 'react-virtuoso'
import toast from 'react-hot-toast'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import { conversationApi, groupApi } from '@/lib/apiServices'
import ChatHeader from './ChatHeader'
import MessageItem from './MessageItem'
import MessageInput from './MessageInput'
import TypingIndicator from '@/components/ui/TypingIndicator'
import DateSeparator from './DateSeparator'
import { groupMessagesByDate } from '@/utils/helpers'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const CHAT_CACHE_TTL_MS = 10 * 60 * 1000

const getChatCacheKey = (type, convId) => `chat-cache:${type || 'direct'}:${convId}`

const readChatCache = (type, convId) => {
  if (!convId || typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(getChatCacheKey(type, convId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.messages) || typeof parsed?.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > CHAT_CACHE_TTL_MS) return null
    return parsed
  } catch (_) {
    return null
  }
}

const writeChatCache = (type, convId, messages, hasMore) => {
  if (!convId || typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      getChatCacheKey(type, convId),
      JSON.stringify({
        messages: messages || [],
        hasMore: !!hasMore,
        savedAt: Date.now(),
      })
    )
  } catch (_) {
    // Ignore quota/storage failures.
  }
}

export default function ChatWindow() {
  const {
    activeConversation,
    activeType,
    messages,
    typingUsers,
    hasMore,
    setMessages,
    setHasMore,
    setLoadingMessages,
    loadingMessages,
    clearUnread,
    removeConversation,
    upsertConversation,
    socket,
    setGroupMemberNickname,
  } = useChatStore()

  const { user } = useAuthStore()
  const convId = activeConversation?.id

  const virtuosoRef = useRef(null)
  const [atBottom, setAtBottom] = useState(true)
  const [firstItemIndex, setFirstItemIndex] = useState(1000)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [initialScrollDone, setInitialScrollDone] = useState(false)

  const convMessages = messages[convId] || []

  // Effect 1: fetch messages when conversation changes (skips if already cached)
  useEffect(() => {
    if (!convId) return
    setInitialScrollDone(false)
    if (messages[convId]?.length > 0) return // already cached — Effect 2 handles join

    const cached = readChatCache(activeType, convId)
    if (cached) {
      setMessages(convId, cached.messages)
      setHasMore(convId, !!cached.hasMore)
      setFirstItemIndex(Math.max(0, 1000 - cached.messages.length))
    }

    const fetchMessages = async () => {
      // If cache exists, avoid loader flicker and refresh in background.
      if (!cached) setLoadingMessages(convId, true)
      try {
        const api = activeType === 'group' ? groupApi : conversationApi
        const { data } = await api.getMessages(convId, { limit: 50, offset: 0 })
        const msgs = data.data?.messages || data.data || []
        setMessages(convId, msgs)
        setHasMore(convId, msgs.length === 50)
        setFirstItemIndex(Math.max(0, 1000 - msgs.length))
        writeChatCache(activeType, convId, msgs, msgs.length === 50)
      } catch (err) {
        console.error('Failed to fetch messages', err)
      } finally {
        if (!cached) setLoadingMessages(convId, false)
      }
    }

    fetchMessages()
  }, [convId, activeType])

  // Effect 2: join socket room + mark read whenever convId OR socket changes.
  // We never emit leave_conversation — the backend keeps us in all rooms so
  // useSocketEvents can deliver new_message events for every conversation.
  useEffect(() => {
    if (!convId || !socket) return
    socket.emit('join_conversation', {
      conversation_id: convId,
      conversation_type: activeType,
    })
    socket.emit('message_read', {
      conversation_id: convId,
      conversation_type: activeType,
    })
    clearUnread(convId)
  }, [convId, socket, activeType])

  // Effect 3: Load group member nicknames when group opens
  useEffect(() => {
    if (!convId || activeType !== 'group') return

    const loadGroupNicknames = async () => {
      try {
        const { data } = await groupApi.getMembers(convId)
        const members = data?.data || []

        // Load nicknames for each member
        await Promise.all(
          members.map(async (member) => {
            try {
              const { data: nicknameData } = await groupApi.getMemberNickname(convId, member.user_id)
              const nickname = nicknameData?.data?.nickname
              if (nickname) {
                setGroupMemberNickname(convId, member.user_id, nickname)
              }
            } catch (_) {
              // Silently fail if nickname not found
            }
          })
        )
      } catch (err) {
        console.error('Failed to load group nicknames:', err)
      }
    }

    loadGroupNicknames()
  }, [convId, activeType, setGroupMemberNickname])

  const loadOlderMessages = useCallback(async () => {
    if (!hasMore[convId] || loadingOlder) return

    setLoadingOlder(true)
    try {
      const api = activeType === 'group' ? groupApi : conversationApi
      const { data } = await api.getMessages(convId, {
        limit: 50,
        offset: convMessages.length,
      })
      const older = data.data?.messages || data.data || []
      if (older.length > 0) {
        const merged = [...older, ...convMessages]
        setMessages(convId, older, true) // prepend
        setFirstItemIndex((prev) => prev - older.length)
        writeChatCache(activeType, convId, merged, true)
      }
      if (older.length < 50) {
        setHasMore(convId, false)
        writeChatCache(activeType, convId, older.length > 0 ? [...older, ...convMessages] : convMessages, false)
      }
    } catch (err) {
      console.error('Failed to load older messages', err)
    } finally {
      setLoadingOlder(false)
    }
  }, [convId, convMessages.length, hasMore, loadingOlder, activeType])

  const grouped = groupMessagesByDate(convMessages)

  // Find the last own message with status='read' — only that one shows the seen avatar (Messenger-style)
  let lastReadOwnMsgId = null
  for (let i = grouped.length - 1; i >= 0; i--) {
    const item = grouped[i]
    if (item.type === 'separator') continue
    const d = item.data
    if (d.sender_id === user?.id && d.status === 'read') {
      lastReadOwnMsgId = d._id || d.id
      break
    }
  }

  const typingNames = (typingUsers[convId] || [])
    .filter((u) => u.user_id !== user?.id)
    .map((u) => u.display_name)

  // Persist latest in-memory list to browser session cache.
  useEffect(() => {
    if (!convId) return
    if (!convMessages.length) return
    writeChatCache(activeType, convId, convMessages, !!hasMore[convId])
  }, [convId, activeType, convMessages, hasMore])

  // For long conversations, jump straight to bottom once messages are ready.
  useEffect(() => {
    if (!convId || !grouped.length || initialScrollDone) return
    const raf1 = requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' })
      const raf2 = requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' })
        setInitialScrollDone(true)
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [convId, grouped.length, initialScrollDone])

  const scrollToBottom = () => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' })
  }

  if (loadingMessages[convId]) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="w-6 h-6 border-2 border-border border-t-accent-yellow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Header */}
      <ChatHeader />

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden">
        <Virtuoso
          ref={virtuosoRef}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={grouped.length - 1}
          data={grouped}
          startReached={loadOlderMessages}
          atBottomStateChange={setAtBottom}
          atBottomThreshold={120}
          followOutput={atBottom ? 'auto' : false}
          itemContent={(index, item) => {
            if (item.type === 'separator') {
              return <DateSeparator key={item.key} date={item.date} />
            }
            const msgId = item.data._id || item.data.id
            return (
              <MessageItem
                key={item.key}
                message={item.data}
                previousMessage={grouped[grouped.indexOf(item) - 1]?.data}
                isOwn={item.data.sender_id === user?.id}
                conversationId={convId}
                isLastReadMessage={msgId === lastReadOwnMsgId}
              />
            )
          }}
          components={{
            Header: () =>
              loadingOlder ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-border border-t-accent-yellow rounded-full animate-spin" />
                </div>
              ) : null,
          }}
          style={{ height: '100%' }}
        />

        {/* Scroll to bottom button */}
        {!atBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 w-10 h-10 bg-bg-elevated border border-border rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all shadow-lg animate-scale-in"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Typing indicator */}
      <TypingIndicator names={typingNames} />

      {/* Blocked / request prompt / message input */}
      {activeConversation?.is_blocked ? (
        <div className="px-4 py-4 border-t border-border bg-bg-secondary text-center text-sm text-text-muted">
          {activeConversation.blocked_by === user?.id
            ? 'You blocked this contact. Unblock from the info panel to chat.'
            : 'You cannot send messages to this contact.'}
        </div>
      ) : activeConversation?.request_status === 'pending' && activeConversation?.request_sender_id !== user?.id ? (
        <RequestPrompt conversationId={convId} />
      ) : (
        <>
          {activeConversation?.request_status === 'pending' && activeConversation?.request_sender_id === user?.id && (
            <p className="text-center text-xs text-text-muted py-1">
              Waiting for the other person to accept your message request
            </p>
          )}
          <MessageInput conversationId={convId} conversationType={activeType} />
        </>
      )}
    </div>
  )
}

// ─── Request Prompt ────────────────────────────────────────────────────────────
function RequestPrompt({ conversationId }) {
  const [loading, setLoading] = useState(false)
  const { upsertConversation, removeConversation, setActiveConversation } = useChatStore()

  const handleAccept = async () => {
    setLoading(true)
    try {
      await conversationApi.acceptRequest(conversationId)
      upsertConversation({ id: conversationId, request_status: 'accepted' })
      toast.success('Request accepted — you can now chat!')
    } catch (_) {
      toast.error('Failed to accept request')
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = async () => {
    setLoading(true)
    try {
      await conversationApi.declineRequest(conversationId)
      removeConversation(conversationId)
      setActiveConversation(null, null)
      toast.success('Request declined')
    } catch (_) {
      toast.error('Failed to decline request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-6 py-5 border-t border-border bg-bg-secondary flex flex-col items-center gap-3">
      <p className="text-sm text-text-secondary text-center max-w-xs">
        This person wants to message you. You can accept or decline their request.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={handleDecline}
          disabled={loading}
          className="px-5 py-2 text-sm rounded-xl border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          disabled={loading}
          className="px-5 py-2 text-sm rounded-xl bg-accent-yellow text-black font-semibold hover:bg-accent-yellow-dim transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Accept'}
        </button>
      </div>
    </div>
  )
}
