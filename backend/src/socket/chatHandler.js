import Message from '../models/Message.js';
import ConversationVisibility from '../models/ConversationVisibility.js';
import { prisma } from '../config/database.js';

/**
 * Chat event handlers — SRS §6.1 and §6.2
 */
const chatHandler = (io, socket) => {
  const userId = socket.user.id;

  const clearHiddenConversationForUsers = async (conversationId, userIds = []) => {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (ids.length === 0) return;

    await ConversationVisibility.deleteMany({
      conversation_id: conversationId,
      user_id: { $in: ids },
    });
  };

  const getDirectConversation = async (conversationId, includeBlocked = true) => {
    const where = {
      id: conversationId,
      OR: [{ participant_1: userId }, { participant_2: userId }],
    };

    if (!includeBlocked) where.is_blocked = false;

    return prisma.conversation.findFirst({
      where,
      select: {
        id: true,
        type: true,
        participant_1: true,
        participant_2: true,
        is_blocked: true,
      },
    });
  };

  const getGroupMembership = async (groupId) => {
    return prisma.groupMember.findUnique({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      select: {
        group_id: true,
        role: true,
        muted_until: true,
      },
    });
  };

  const resolveConversationAccess = async (conversationId, hintedType = null, options = {}) => {
    if (!conversationId) return null;

    const { includeBlocked = true } = options;

    if (hintedType === 'group') {
      const member = await getGroupMembership(conversationId);
      if (!member) return null;
      return { type: 'group', member };
    }

    if (hintedType && hintedType !== 'group') {
      const conversation = await getDirectConversation(conversationId, includeBlocked);
      if (!conversation) return null;
      return { type: 'direct', conversation };
    }

    const conversation = await getDirectConversation(conversationId, includeBlocked);
    if (conversation) return { type: 'direct', conversation };

    const member = await getGroupMembership(conversationId);
    if (member) return { type: 'group', member };

    return null;
  };

  // ─── JOIN CONVERSATION ───────────────────────
  socket.on('join_conversation', async ({ conversation_id, conversation_type }) => {
    if (!conversation_id) return;

    try {
      const hintedType = conversation_type === 'group' ? 'group' : null;
      const access = await resolveConversationAccess(conversation_id, hintedType);
      if (!access) return;

      socket.join(`conv:${conversation_id}`);
      console.log(`${socket.user.display_name} joined conv:${conversation_id}`);
    } catch (err) {
      console.error('join_conversation error:', err.message);
    }
  });

  // ─── LEAVE CONVERSATION ──────────────────────
  socket.on('leave_conversation', ({ conversation_id }) => {
    socket.leave(`conv:${conversation_id}`);
  });

  // ─── SEND MESSAGE ────────────────────────────
  socket.on('send_message', async (data, callback) => {
    try {
      const { conversation_id, conversation_type, content, message_type, reply_to, expires_in, mentions } = data;

      // Validate
      if (!conversation_id || !content) {
        return callback?.({ error: 'conversation_id and content required' });
      }

      const hintedType = conversation_type === 'group' ? 'group' : 'direct';
      const access = await resolveConversationAccess(conversation_id, hintedType, {
        includeBlocked: false,
      });

      if (!access) {
        return callback?.({ error: 'Conversation not found or access denied' });
      }

      // Group moderation checks
      if (access.type === 'group') {
        if (access.member?.muted_until && new Date(access.member.muted_until) > new Date()) {
          return callback?.({ error: 'You are muted in this group' });
        }
      }

      // Friend request gate (direct chats only)
      if (access.type !== 'group') {
        const otherCheckUid = access.conversation.participant_1 === userId
          ? access.conversation.participant_2
          : access.conversation.participant_1;
        const pendingReq = await prisma.friendRequest.findFirst({
          where: { sender_id: otherCheckUid, receiver_id: userId, status: 'pending' },
        });
        if (pendingReq) {
          return callback?.({ error: 'Accept the message request first to reply' });
        }
      }

      // Build message data
      const messageData = {
        conversation_id,
        conversation_type:
          access.type === 'group'
            ? 'group'
            : access.conversation.type === 'private_encrypted'
              ? 'private'
              : 'direct',
        sender_id: userId,
        message_type: message_type || 'text',
        content: typeof content === 'string' ? { text: content } : content,
        reply_to: reply_to || null,
        mentions: mentions || [],
      };

      // Disappearing messages
      if (expires_in) {
        const expiresMap = { '1h': 3600, '24h': 86400, '7d': 604800 };
        const seconds = expiresMap[expires_in] || parseInt(expires_in, 10);
        if (seconds) messageData.expires_at = new Date(Date.now() + seconds * 1000);
      }

      const message = await Message.create(messageData);

      const populated = await Message.findById(message._id)
        .populate('reply_to', 'content sender_id message_type')
        .lean();

      // Add sender info
      populated.sender = {
        id: socket.user.id,
        username: socket.user.username,
        display_name: socket.user.display_name,
        avatar_url: socket.user.avatar_url,
      };

      // ── Determine initial delivery status ──────────────────────────────
      // For direct chats: check if receiver is ONLINE (connected to socket).
      // Online = in their personal user:${id} room. This means "delivered".
      // "Seen" only happens when they open the conversation (message_read).
      let initialStatus = 'sent';
      if (access.type !== 'group') {
        const receiverId = access.conversation.participant_1 === userId
          ? access.conversation.participant_2
          : access.conversation.participant_1;
        const receiverSockets = await io.in(`user:${receiverId}`).fetchSockets();
        if (receiverSockets.length > 0) {
          initialStatus = 'delivered';
          // Persist delivered_to in DB (fire-and-forget)
          Message.findByIdAndUpdate(message._id, {
            $addToSet: { delivered_to: receiverId },
          }).catch(() => {});
        }
      }
      populated.status = initialStatus;

      // Broadcast to everyone in the conv room EXCEPT the sender
      socket.to(`conv:${conversation_id}`).emit('new_message', populated);

      // If already delivered, notify sender in real-time
      if (initialStatus === 'delivered') {
        socket.emit('message_delivered', {
          message_id: populated._id.toString(),
          conversation_id,
        });
      }

      // Update conversation timestamp (for direct chats)
      if (access.type !== 'group') {
        Promise.all([
          prisma.conversation.update({
            where: { id: conversation_id },
            data: { updated_at: new Date() },
          }),
          clearHiddenConversationForUsers(conversation_id, [
            access.conversation.participant_1,
            access.conversation.participant_2,
          ]),
        ]).catch(() => {});
      }

      callback?.({ success: true, message: populated });
    } catch (err) {
      console.error('send_message error:', err.message);
      callback?.({ error: 'Failed to send message' });
    }
  });

  // ─── TYPING START ────────────────────────────
  socket.on('typing_start', ({ conversation_id }) => {
    if (!conversation_id) return;
    socket.to(`conv:${conversation_id}`).emit('user_typing', {
      user_id: userId,
      username: socket.user.username,
      display_name: socket.user.display_name,
      conversation_id,
    });
  });

  // ─── TYPING STOP ─────────────────────────────
  socket.on('typing_stop', ({ conversation_id }) => {
    if (!conversation_id) return;
    socket.to(`conv:${conversation_id}`).emit('user_stopped_typing', {
      user_id: userId,
      conversation_id,
    });
  });

  // ─── MESSAGE READ ────────────────────────────
  socket.on('message_read', async ({ message_id, conversation_id, conversation_type }) => {
    try {
      if (!conversation_id && !message_id) return;

      let targetConversationId = conversation_id;
      let targetConversationType = conversation_type || null;

      // Resolve conversation from message when only message_id is provided
      if (!targetConversationId && message_id) {
        const msg = await Message.findById(message_id)
          .select('conversation_id conversation_type')
          .lean();

        if (!msg) return;
        targetConversationId = msg.conversation_id;
        targetConversationType = msg.conversation_type;
      }

      const access = await resolveConversationAccess(targetConversationId, targetConversationType);
      if (!access) return;
      const readAt = new Date();

      // ── Single message read ──────────────────────────────────────────
      if (message_id) {
        await Message.findOneAndUpdate(
          { _id: message_id, conversation_id: targetConversationId },
          { $addToSet: { read_receipts: { user_id: userId, read_at: readAt } } }
        );

        // Notify the room (sender receives this) with reader info for seen avatar
        socket.to(`conv:${targetConversationId}`).emit('message_read', {
          message_id,
          conversation_id: targetConversationId,
          reader_id: userId,
          reader_avatar_url: socket.user.avatar_url,
          reader_display_name: socket.user.display_name,
          read_at: readAt,
        });
      }

      // ── Group: update member last_read_at ──────────────────────────
      if (access.type === 'group') {
        await prisma.groupMember.update({
          where: { group_id_user_id: { group_id: targetConversationId, user_id: userId } },
          data: { last_read_at: readAt },
        });
      } else if (!message_id) {
        // ── Direct chat bulk read: find unread messages then mark + notify ──
        const unreadMessages = await Message.find(
          {
            conversation_id: targetConversationId,
            sender_id: { $ne: userId },
            is_deleted: false,
            deleted_for_all: false,
            deleted_for: { $ne: userId },
            'read_receipts.user_id': { $ne: userId },
          },
          '_id'
        ).lean();

        if (unreadMessages.length > 0) {
          const messageIds = unreadMessages.map((m) => m._id.toString());

          await Message.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { read_receipts: { user_id: userId, read_at: readAt } } }
          );

          // Notify the sender (everyone in room except reader) in real-time
          socket.to(`conv:${targetConversationId}`).emit('messages_read', {
            message_ids: messageIds,
            conversation_id: targetConversationId,
            reader_id: userId,
            reader_avatar_url: socket.user.avatar_url,
            reader_display_name: socket.user.display_name,
            read_at: readAt,
          });
        }
      }
    } catch (err) {
      console.error('message_read error:', err.message);
    }
  });

  // ─── MARK DELIVERED ──────────────────────────
  socket.on('mark_delivered', async ({ message_id }) => {
    try {
      const message = await Message.findById(message_id);
      if (!message) return;

      const access = await resolveConversationAccess(
        message.conversation_id,
        message.conversation_type
      );
      if (!access) return;

      await Message.findByIdAndUpdate(message_id, {
        $addToSet: { delivered_to: userId },
      });

      socket.to(`conv:${message.conversation_id}`).emit('message_delivered', {
        message_id,
        conversation_id: message.conversation_id,
        user_id: userId,
      });
    } catch (err) {
      console.error('mark_delivered error:', err.message);
    }
  });

  // ─── REACT TO MESSAGE ───────────────────────
  socket.on('react_message', async ({ message_id, emoji }) => {
    try {
      const message = await Message.findById(message_id);
      if (!message) return;

      const access = await resolveConversationAccess(
        message.conversation_id,
        message.conversation_type
      );
      if (!access) return;

      // Remove existing reaction from this user
      message.reactions = message.reactions.filter((r) => r.user_id !== userId);

      if (emoji) {
        message.reactions.push({ user_id: userId, emoji, reacted_at: new Date() });
      }

      await message.save();

      io.to(`conv:${message.conversation_id}`).emit('reaction_update', {
        message_id,
        conversation_id: message.conversation_id,
        reactions: message.reactions,
      });
    } catch (err) {
      console.error('react_message error:', err.message);
    }
  });

  // ─── PIN MESSAGE ─────────────────────────────
  socket.on('pin_message', async ({ message_id, conversation_id }) => {
    try {
      const message = await Message.findById(message_id);
      if (!message) return;

      const access = await resolveConversationAccess(
        message.conversation_id,
        message.conversation_type
      );
      if (!access) return;

      message.is_pinned = !message.is_pinned;
      await message.save();

      io.to(`conv:${message.conversation_id}`).emit('message_pinned', {
        message_id,
        conversation_id: message.conversation_id,
        is_pinned: message.is_pinned,
        pinned_by: userId,
      });
    } catch (err) {
      console.error('pin_message error:', err.message);
    }
  });

  // ─── DELETE MESSAGE ──────────────────────────
  socket.on('delete_message', async ({ message_id, for_all }) => {
    try {
      const message = await Message.findById(message_id);
      if (!message) return;

      const access = await resolveConversationAccess(
        message.conversation_id,
        message.conversation_type
      );
      if (!access) return;

      if (for_all && message.sender_id === userId) {
        message.deleted_for_all = true;
        message.is_deleted = true;
      } else {
        if (!message.deleted_for.includes(userId)) {
          message.deleted_for.push(userId);
        }
      }

      await message.save();

      if (for_all) {
        io.to(`conv:${message.conversation_id}`).emit('message_deleted', {
          message_id,
          conversation_id: message.conversation_id,
          deleted_for_all: true,
        });
      } else {
        socket.emit('message_deleted', {
          message_id,
          conversation_id: message.conversation_id,
          deleted_for_all: false,
        });
      }
    } catch (err) {
      console.error('delete_message error:', err.message);
    }
  });

  // ─── EDIT MESSAGE ────────────────────────────
  socket.on('edit_message', async ({ message_id, text }) => {
    try {
      const message = await Message.findById(message_id);
      if (!message || message.sender_id !== userId || !text?.trim()) return;

      const access = await resolveConversationAccess(
        message.conversation_id,
        message.conversation_type
      );
      if (!access) return;

      message.edit_history.push({ content: message.content?.text || '', edited_at: new Date() });
      message.content.text = text.trim();
      message.is_edited = true;
      await message.save();

      io.to(`conv:${message.conversation_id}`).emit('message_edited', {
        message_id,
        conversation_id: message.conversation_id,
        new_content: { text: text.trim() },
        is_edited: true,
      });
    } catch (err) {
      console.error('edit_message error:', err.message);
    }
  });
};

export default chatHandler;
