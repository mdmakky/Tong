import Message from '../models/Message.js';
import { prisma } from '../config/database.js';

/**
 * Chat event handlers — SRS §6.1 and §6.2
 */
const chatHandler = (io, socket) => {
  const userId = socket.user.id;

  // ─── JOIN CONVERSATION ───────────────────────
  socket.on('join_conversation', ({ conversation_id }) => {
    socket.join(`conv:${conversation_id}`);
    console.log(`${socket.user.display_name} joined conv:${conversation_id}`);
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

      // Block check + friend request gate (direct chats only)
      if ((conversation_type || 'direct') !== 'group') {
        const convCheck = await prisma.conversation.findFirst({
          where: { id: conversation_id, is_blocked: false },
          select: { participant_1: true, participant_2: true },
        });
        if (!convCheck) {
          return callback?.({ error: 'Conversation not found or blocked' });
        }
        const otherCheckUid = convCheck.participant_1 === userId
          ? convCheck.participant_2
          : convCheck.participant_1;
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
        conversation_type: conversation_type || 'direct',
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

      // Broadcast to everyone in the conv room EXCEPT the sender
      socket.to(`conv:${conversation_id}`).emit('new_message', populated);

      // Update conversation timestamp (for direct chats)
      if (conversation_type !== 'group') {
        prisma.conversation.update({
          where: { id: conversation_id },
          data: { updated_at: new Date() },
        }).catch(() => {});
      }

      callback?.({ success: true, message: populated });
    } catch (err) {
      console.error('send_message error:', err.message);
      callback?.({ error: 'Failed to send message' });
    }
  });

  // ─── TYPING START ────────────────────────────
  socket.on('typing_start', ({ conversation_id }) => {
    socket.to(`conv:${conversation_id}`).emit('user_typing', {
      user_id: userId,
      username: socket.user.username,
      display_name: socket.user.display_name,
      conversation_id,
    });
  });

  // ─── TYPING STOP ─────────────────────────────
  socket.on('typing_stop', ({ conversation_id }) => {
    socket.to(`conv:${conversation_id}`).emit('user_stopped_typing', {
      user_id: userId,
      conversation_id,
    });
  });

  // ─── MESSAGE READ ────────────────────────────
  socket.on('message_read', async ({ message_id, conversation_id }) => {
    try {
      await Message.findByIdAndUpdate(message_id, {
        $addToSet: {
          read_receipts: { user_id: userId, read_at: new Date() },
        },
      });

      socket.to(`conv:${conversation_id}`).emit('message_read', {
        message_id,
        user_id: userId,
        read_at: new Date(),
      });
    } catch (err) {
      console.error('message_read error:', err.message);
    }
  });

  // ─── MARK DELIVERED ──────────────────────────
  socket.on('mark_delivered', async ({ message_id }) => {
    try {
      const message = await Message.findByIdAndUpdate(
        message_id,
        { $addToSet: { delivered_to: userId } },
        { new: true }
      );

      if (message) {
        socket.to(`conv:${message.conversation_id}`).emit('message_delivered', {
          message_id,
          user_id: userId,
        });
      }
    } catch (err) {
      console.error('mark_delivered error:', err.message);
    }
  });

  // ─── REACT TO MESSAGE ───────────────────────
  socket.on('react_message', async ({ message_id, emoji }) => {
    try {
      const message = await Message.findById(message_id);
      if (!message) return;

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

      message.is_pinned = !message.is_pinned;
      await message.save();

      io.to(`conv:${conversation_id}`).emit('message_pinned', {
        message_id,
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
          deleted_for_all: true,
        });
      } else {
        socket.emit('message_deleted', {
          message_id,
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
      if (!message || message.sender_id !== userId) return;

      message.edit_history.push({ content: message.content.text, edited_at: new Date() });
      message.content.text = text;
      message.is_edited = true;
      await message.save();

      io.to(`conv:${message.conversation_id}`).emit('message_edited', {
        message_id,
        new_content: { text },
        is_edited: true,
      });
    } catch (err) {
      console.error('edit_message error:', err.message);
    }
  });
};

export default chatHandler;
