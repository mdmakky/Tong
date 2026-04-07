import Message from '../models/Message.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

// ─── EDIT MESSAGE ──────────────────────────────
export const editMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { text } = req.body;

    const message = await Message.findById(id);
    if (!message) throw ApiError.notFound('Message not found');
    if (message.sender_id !== userId) throw ApiError.forbidden('Can only edit your own messages');
    if (message.is_deleted || message.deleted_for_all) throw ApiError.badRequest('Cannot edit deleted message');

    // Save edit history
    message.edit_history.push({
      content: message.content.text,
      edited_at: new Date(),
    });
    message.content.text = text;
    message.is_edited = true;
    await message.save();

    return ApiResponse.ok('Message edited', message).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE MESSAGE ────────────────────────────
export const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { for_all } = req.body;

    const message = await Message.findById(id);
    if (!message) throw ApiError.notFound('Message not found');

    if (for_all) {
      // Only sender can delete for all
      if (message.sender_id !== userId) {
        throw ApiError.forbidden('Only the sender can delete for everyone');
      }
      message.deleted_for_all = true;
      message.is_deleted = true;
    } else {
      // Delete for self
      if (!message.deleted_for.includes(userId)) {
        message.deleted_for.push(userId);
      }
    }

    await message.save();

    return ApiResponse.ok('Message deleted', {
      message_id: id,
      deleted_for_all: message.deleted_for_all,
    }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── ADD REACTION ──────────────────────────────
export const addReaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { emoji } = req.body;

    if (!emoji) throw ApiError.badRequest('Emoji is required');

    const message = await Message.findById(id);
    if (!message) throw ApiError.notFound('Message not found');

    // Remove existing reaction from this user
    message.reactions = message.reactions.filter((r) => r.user_id !== userId);

    // Add new reaction
    message.reactions.push({ user_id: userId, emoji, reacted_at: new Date() });
    await message.save();

    return ApiResponse.ok('Reaction added', { reactions: message.reactions }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── REMOVE REACTION ───────────────────────────
export const removeReaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(id);
    if (!message) throw ApiError.notFound('Message not found');

    message.reactions = message.reactions.filter((r) => r.user_id !== userId);
    await message.save();

    return ApiResponse.ok('Reaction removed', { reactions: message.reactions }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── PIN MESSAGE ───────────────────────────────
export const pinMessage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const message = await Message.findById(id);
    if (!message) throw ApiError.notFound('Message not found');

    message.is_pinned = !message.is_pinned;
    await message.save();

    return ApiResponse.ok(
      message.is_pinned ? 'Message pinned' : 'Message unpinned',
      { is_pinned: message.is_pinned }
    ).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GET PINNED MESSAGES ───────────────────────
export const getPinnedMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({
      conversation_id: conversationId,
      is_pinned: true,
      is_deleted: false,
      deleted_for_all: false,
    })
      .sort({ created_at: -1 })
      .lean();

    return ApiResponse.ok('Pinned messages', messages).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── FORWARD MESSAGE ───────────────────────────
export const forwardMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { conversation_ids } = req.body; // Array of target conversation IDs

    if (!conversation_ids || !Array.isArray(conversation_ids) || conversation_ids.length === 0) {
      throw ApiError.badRequest('Target conversations are required');
    }

    const original = await Message.findById(id);
    if (!original) throw ApiError.notFound('Original message not found');

    // Check if original is from a secret chat (no forwarding)
    if (original.conversation_type === 'private') {
      throw ApiError.forbidden('Cannot forward messages from private/encrypted chats');
    }

    const forwarded = [];

    for (const convId of conversation_ids) {
      const message = await Message.create({
        conversation_id: convId,
        conversation_type: 'direct', // Will be set properly based on conversation
        sender_id: userId,
        message_type: 'forwarded',
        content: original.content,
        forwarded_from: original._id,
      });
      forwarded.push(message);
    }

    return ApiResponse.created('Message forwarded', forwarded).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── STAR/BOOKMARK MESSAGE ─────────────────────
export const starMessage = async (req, res, next) => {
  try {
    // Stars are stored per-user in Redis or a separate collection
    // For simplicity, we'll use the message's reactions with a special "⭐" emoji
    const { id } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(id);
    if (!message) throw ApiError.notFound('Message not found');

    const existingStar = message.reactions.find(
      (r) => r.user_id === userId && r.emoji === '⭐'
    );

    if (existingStar) {
      message.reactions = message.reactions.filter(
        (r) => !(r.user_id === userId && r.emoji === '⭐')
      );
    } else {
      message.reactions.push({ user_id: userId, emoji: '⭐', reacted_at: new Date() });
    }

    await message.save();

    return ApiResponse.ok(
      existingStar ? 'Message unstarred' : 'Message starred'
    ).send(res);
  } catch (err) {
    next(err);
  }
};
