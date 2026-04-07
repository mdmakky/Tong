import { useEffect, useRef } from 'react'
import { getSocket } from '@/lib/socket'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'

/**
 * Connects all Socket.io server→client events to Zustand store
 */
export default function useSocketEvents() {
  const socket = getSocket()
  const bound = useRef(false)

  const {
    appendMessage,
    updateMessage,
    deleteMessage,
    updateReaction,
    setUserTyping,
    updatePresence,
    upsertConversation,
    upsertGroup,
    incrementUnread,
    activeConversation,
  } = useChatStore()

  const { updateUser } = useAuthStore()

  useEffect(() => {
    if (!socket || bound.current) return
    bound.current = true

    // ─── New message ───
    socket.on('new_message', (message) => {
      const convId = message.conversation_id
      appendMessage(convId, message)
      incrementUnread(convId)

      // Update last message in conversation list
      upsertConversation({
        id: convId,
        last_message: message,
        last_message_at: message.created_at,
      })
    })

    // ─── Message delivered ───
    socket.on('message_delivered', ({ message_id, conversation_id }) => {
      updateMessage(conversation_id, message_id, { status: 'delivered' })
    })

    // ─── Message read ───
    socket.on('message_read', ({ message_id, conversation_id }) => {
      updateMessage(conversation_id, message_id, { status: 'read' })
    })

    // ─── Message edited ───
    socket.on('message_edited', ({ message_id, conversation_id, new_content, edited_at }) => {
      updateMessage(conversation_id, message_id, {
        content: new_content,
        edited_at,
      })
    })

    // ─── Message deleted ───
    socket.on('message_deleted', ({ message_id, conversation_id, deleted_for_all }) => {
      if (deleted_for_all) {
        deleteMessage(conversation_id, message_id)
      }
    })

    // ─── Reaction update ───
    socket.on('reaction_update', ({ message_id, conversation_id, reactions }) => {
      updateReaction(conversation_id, message_id, reactions)
    })

    // ─── Typing ───
    socket.on('user_typing', ({ user_id, display_name, conversation_id }) => {
      setUserTyping(conversation_id, { user_id, display_name }, true)
    })

    socket.on('user_stopped_typing', ({ user_id, conversation_id }) => {
      setUserTyping(conversation_id, { user_id }, false)
    })

    // ─── Presence ───
    socket.on('presence_update', ({ user_id, status, last_seen }) => {
      updatePresence(user_id, status, last_seen)
    })

    // ─── New conversation (notified by other side creating it) ───
    socket.on('new_conversation', (conv) => {
      upsertConversation(conv)
      // Auto-join the socket room so we receive real-time messages immediately
      socket.emit('join_conversation', { conversation_id: conv.id })
    })

    // ─── Group updated ───
    socket.on('group_updated', ({ group_id, changes }) => {
      upsertGroup({ id: group_id, ...changes })
    })

    // ─── Member events ───
    socket.on('member_joined', ({ group_id }) => {
      // Handled via group refetch if needed
    })

    socket.on('member_left', ({ group_id, user_id }) => {
      // If current user was removed, remove group from list
    })

    return () => {
      if (socket) {
        socket.off('new_message')
        socket.off('message_delivered')
        socket.off('message_read')
        socket.off('message_edited')
        socket.off('message_deleted')
        socket.off('reaction_update')
        socket.off('user_typing')
        socket.off('user_stopped_typing')
        socket.off('presence_update')
        socket.off('new_conversation')
        socket.off('group_updated')
        socket.off('member_joined')
        socket.off('member_left')
      }
      bound.current = false
    }
  }, [socket])
}
