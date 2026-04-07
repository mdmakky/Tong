import { useEffect } from 'react'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'

/**
 * Connects all Socket.io server→client events to Zustand store.
 * Socket is read from chatStore so the effect re-runs as soon as
 * initSocket() stores the instance (fully reactive).
 */
export default function useSocketEvents() {
  // Reactive: re-runs whenever socket is set/cleared in the store
  const socket = useChatStore((s) => s.socket)

  const {
    appendMessage,
    updateMessage,
    deleteMessage,
    updateReaction,
    setUserTyping,
    updatePresence,
    upsertConversation,
    upsertGroup,
    removeConversation,
    incrementUnread,
  } = useChatStore()

  const { updateUser } = useAuthStore()

  useEffect(() => {
    if (!socket) return

    // ─── New message ───
    const onNewMessage = (message) => {
      const convId = message.conversation_id
      appendMessage(convId, message)
      incrementUnread(convId)
      upsertConversation({
        id: convId,
        last_message: message,
        last_message_at: message.created_at,
      })
    }

    // ─── Message delivered ───
    const onDelivered = ({ message_id, conversation_id }) => {
      updateMessage(conversation_id, message_id, { status: 'delivered' })
    }

    // ─── Message read ───
    const onRead = ({ message_id, conversation_id }) => {
      updateMessage(conversation_id, message_id, { status: 'read' })
    }

    // ─── Message edited ───
    const onEdited = ({ message_id, conversation_id, new_content, edited_at }) => {
      updateMessage(conversation_id, message_id, { content: new_content, edited_at })
    }

    // ─── Message deleted ───
    const onDeleted = ({ message_id, conversation_id, deleted_for_all }) => {
      if (deleted_for_all) deleteMessage(conversation_id, message_id)
    }

    // ─── Reaction update ───
    const onReaction = ({ message_id, conversation_id, reactions }) => {
      updateReaction(conversation_id, message_id, reactions)
    }

    // ─── Typing ───
    const onTypingStart = ({ user_id, display_name, conversation_id }) => {
      setUserTyping(conversation_id, { user_id, display_name }, true)
    }
    const onTypingStop = ({ user_id, conversation_id }) => {
      setUserTyping(conversation_id, { user_id }, false)
    }

    // ─── Presence ───
    const onPresence = ({ user_id, status, last_seen }) => {
      updatePresence(user_id, status, last_seen)
    }

    // ─── New conversation ───
    const onNewConversation = (conv) => {
      upsertConversation(conv)
      socket.emit('join_conversation', { conversation_id: conv.id })
    }

    // ─── Friend request accepted (requester notified) ───
    const onRequestAccepted = ({ conversation_id }) => {
      upsertConversation({ id: conversation_id, request_status: 'accepted' })
    }

    // ─── Friend request declined (requester notified) ───
    const onRequestDeclined = ({ conversation_id }) => {
      removeConversation(conversation_id)
    }

    // ─── Group updated ───
    const onGroupUpdated = ({ group_id, changes }) => {
      upsertGroup({ id: group_id, ...changes })
    }

    socket.on('new_message', onNewMessage)
    socket.on('message_delivered', onDelivered)
    socket.on('message_read', onRead)
    socket.on('message_edited', onEdited)
    socket.on('message_deleted', onDeleted)
    socket.on('reaction_update', onReaction)
    socket.on('user_typing', onTypingStart)
    socket.on('user_stopped_typing', onTypingStop)
    socket.on('presence_update', onPresence)
    socket.on('new_conversation', onNewConversation)
    socket.on('friend_request_accepted', onRequestAccepted)
    socket.on('friend_request_declined', onRequestDeclined)
    socket.on('group_updated', onGroupUpdated)

    return () => {
      socket.off('new_message', onNewMessage)
      socket.off('message_delivered', onDelivered)
      socket.off('message_read', onRead)
      socket.off('message_edited', onEdited)
      socket.off('message_deleted', onDeleted)
      socket.off('reaction_update', onReaction)
      socket.off('user_typing', onTypingStart)
      socket.off('user_stopped_typing', onTypingStop)
      socket.off('presence_update', onPresence)
      socket.off('new_conversation', onNewConversation)
      socket.off('friend_request_accepted', onRequestAccepted)
      socket.off('friend_request_declined', onRequestDeclined)
      socket.off('group_updated', onGroupUpdated)
    }
  }, [socket])
}
