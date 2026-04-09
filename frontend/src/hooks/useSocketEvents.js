import { useEffect } from 'react'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import { groupApi } from '@/lib/apiServices'

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
    removeGroup,
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

      // Auto-acknowledge delivery so the sender sees double-tick in real-time
      if (message._id && message.conversation_type !== 'group') {
        socket.emit('mark_delivered', { message_id: message._id })
      }

      if (message.conversation_type === 'group') {
        upsertGroup({
          id: convId,
          last_message: message,
          last_message_at: message.created_at,
        })
      } else {
        upsertConversation({
          id: convId,
          last_message: message,
          last_message_at: message.created_at,
        })
      }
    }

    // ─── Message delivered ───
    const onDelivered = ({ message_id, conversation_id }) => {
      updateMessage(conversation_id, message_id, { status: 'delivered' })
    }

    // ─── Single message read ───
    const onRead = ({ message_id, conversation_id, reader_id, reader_avatar_url, reader_display_name, read_at }) => {
      updateMessage(conversation_id, message_id, {
        status: 'read',
        read_by: { reader_id, reader_avatar_url, reader_display_name, read_at },
      })
    }

    // ─── Bulk messages read (when receiver opens the conversation) ───
    const onBulkRead = ({ message_ids, conversation_id, reader_id, reader_avatar_url, reader_display_name, read_at }) => {
      const readInfo = { reader_id, reader_avatar_url, reader_display_name, read_at }
      // For 1-to-1 chats: if the receiver opened the conversation, they saw everything.
      // Mark ALL own messages in that conversation as 'read'.
      const store = useChatStore.getState()
      const convMessages = store.messages[conversation_id] || []
      if (convMessages.length === 0) return

      const currentUserId = useAuthStore.getState().user?.id
      const updated = convMessages.map((m) => {
        // Only update own messages (the ones the sender sent)
        if (m.sender_id === currentUserId && m.status !== 'read') {
          return { ...m, status: 'read', read_by: readInfo }
        }
        return m
      })
      useChatStore.setState((state) => ({
        messages: { ...state.messages, [conversation_id]: updated },
      }))
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
    const onNewConversation = async (payload) => {
      if (!payload) return

      if (payload.type === 'group') {
        if (payload.group?.id) {
          upsertGroup(payload.group)
          socket.emit('join_conversation', {
            conversation_id: payload.group.id,
            conversation_type: 'group',
          })
          return
        }

        if (payload.group_id) {
          try {
            const { data } = await groupApi.get(payload.group_id)
            const group = data?.data
            if (!group?.id) return
            upsertGroup(group)
            socket.emit('join_conversation', {
              conversation_id: group.id,
              conversation_type: 'group',
            })
          } catch (_) {}
          return
        }
      }

      if (!payload.id) return
      upsertConversation(payload)
      socket.emit('join_conversation', {
        conversation_id: payload.id,
        conversation_type: payload.type,
      })
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

    const onMemberJoined = ({ group_id }) => {
      if (!group_id) return
      groupApi
        .get(group_id)
        .then((r) => {
          const group = r.data?.data
          if (group?.id) upsertGroup(group)
        })
        .catch(() => {})
    }

    const onMemberLeft = ({ group_id }) => {
      if (!group_id) return
      groupApi
        .get(group_id)
        .then((r) => {
          const group = r.data?.data
          if (group?.id) upsertGroup(group)
        })
        .catch(() => {})
    }

    const onMemberRoleUpdated = ({ group_id }) => {
      if (!group_id) return
      groupApi
        .get(group_id)
        .then((r) => {
          const group = r.data?.data
          if (group?.id) upsertGroup(group)
        })
        .catch(() => {})
    }

    const onRemovedFromGroup = ({ group_id }) => {
      if (!group_id) return
      removeGroup(group_id)
    }

    const onGroupDeleted = ({ group_id }) => {
      if (!group_id) return
      removeGroup(group_id)
    }

    socket.on('new_message', onNewMessage)
    socket.on('message_delivered', onDelivered)
    socket.on('message_read', onRead)
    socket.on('messages_read', onBulkRead)
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
    socket.on('member_joined', onMemberJoined)
    socket.on('member_left', onMemberLeft)
    socket.on('member_role_updated', onMemberRoleUpdated)
    socket.on('removed_from_group', onRemovedFromGroup)
    socket.on('group_deleted', onGroupDeleted)

    return () => {
      socket.off('new_message', onNewMessage)
      socket.off('message_delivered', onDelivered)
      socket.off('message_read', onRead)
      socket.off('messages_read', onBulkRead)
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
      socket.off('member_joined', onMemberJoined)
      socket.off('member_left', onMemberLeft)
      socket.off('member_role_updated', onMemberRoleUpdated)
      socket.off('removed_from_group', onRemovedFromGroup)
      socket.off('group_deleted', onGroupDeleted)
    }
  }, [socket])
}
