import { prisma } from '../config/database.js';
import Message from '../models/Message.js';
import { getPagination } from '../utils/helpers.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

// ─── GET ALL CONVERSATIONS ─────────────────────
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant_1: userId },
          { participant_2: userId },
        ],
      },
      include: {
        user1: {
          select: { id: true, username: true, display_name: true, avatar_url: true, online_status: true, last_seen: true },
        },
        user2: {
          select: { id: true, username: true, display_name: true, avatar_url: true, online_status: true, last_seen: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    // Enrich with last message from MongoDB
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = conv.participant_1 === userId ? conv.user2 : conv.user1;
        const lastMessage = await Message.findOne({
          conversation_id: conv.id,
          is_deleted: false,
          deleted_for_all: false,
        })
          .sort({ created_at: -1 })
          .select('content message_type sender_id created_at')
          .lean();

        // Get unread count
        const unreadCount = await Message.countDocuments({
          conversation_id: conv.id,
          sender_id: { $ne: userId },
          'read_receipts.user_id': { $ne: userId },
          is_deleted: false,
        });

        return {
          id: conv.id,
          type: conv.type,
          is_blocked: conv.is_blocked,
          blocked_by: conv.blocked_by,
          other_user: otherUser,
          last_message: lastMessage || null,
          unread_count: unreadCount,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        };
      })
    );

    // Sort by last message time
    enriched.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at;
      const bTime = b.last_message?.created_at || b.created_at;
      return new Date(bTime) - new Date(aTime);
    });

    return ApiResponse.ok('Conversations retrieved', enriched).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── CREATE CONVERSATION ───────────────────────
export const createConversation = async (req, res, next) => {
  try {
    const { participant_id, type } = req.body;
    const userId = req.user.id;

    if (participant_id === userId) {
      throw ApiError.badRequest('Cannot create conversation with yourself');
    }

    // Check participant exists
    const otherUser = await prisma.user.findUnique({
      where: { id: participant_id },
      select: { id: true, username: true, display_name: true, avatar_url: true, status: true },
    });
    if (!otherUser || otherUser.status !== 'active') {
      throw ApiError.notFound('User not found');
    }

    // Check if blocked
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blocker_id: userId, blocked_id: participant_id },
          { blocker_id: participant_id, blocked_id: userId },
        ],
      },
    });
    if (block) throw ApiError.forbidden('Cannot create conversation — user is blocked');

    // Check existing conversation (either direction)
    const existing = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant_1: userId, participant_2: participant_id },
          { participant_1: participant_id, participant_2: userId },
        ],
      },
    });

    if (existing) {
      return ApiResponse.ok('Conversation already exists', existing).send(res);
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: type || 'direct',
        participant_1: userId,
        participant_2: participant_id,
      },
      include: {
        user1: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
        user2: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
      },
    });

    return ApiResponse.created('Conversation created', conversation).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GET CONVERSATION BY ID ────────────────────
export const getConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        OR: [
          { participant_1: userId },
          { participant_2: userId },
        ],
      },
      include: {
        user1: {
          select: { id: true, username: true, display_name: true, avatar_url: true, online_status: true, last_seen: true, bio: true },
        },
        user2: {
          select: { id: true, username: true, display_name: true, avatar_url: true, online_status: true, last_seen: true, bio: true },
        },
      },
    });

    if (!conversation) throw ApiError.notFound('Conversation not found');

    return ApiResponse.ok('Conversation retrieved', conversation).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE CONVERSATION ───────────────────────
export const deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        OR: [
          { participant_1: userId },
          { participant_2: userId },
        ],
      },
    });

    if (!conversation) throw ApiError.notFound('Conversation not found');

    // Soft delete — mark messages as deleted for this user
    await Message.updateMany(
      { conversation_id: id },
      { $addToSet: { deleted_for: userId } }
    );

    return ApiResponse.ok('Conversation deleted for you').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GET MESSAGES ──────────────────────────────
export const getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const { before } = req.query; // cursor-based: pass last message _id

    // Verify user is participant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        OR: [
          { participant_1: userId },
          { participant_2: userId },
        ],
      },
    });

    if (!conversation) throw ApiError.notFound('Conversation not found');

    const query = {
      conversation_id: id,
      deleted_for: { $ne: userId },
      deleted_for_all: false,
    };

    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ created_at: -1 })
      .skip(before ? 0 : skip)
      .limit(limit)
      .populate('reply_to', 'content sender_id message_type created_at')
      .lean();

    const total = await Message.countDocuments({
      conversation_id: id,
      deleted_for: { $ne: userId },
      deleted_for_all: false,
    });

    return ApiResponse.ok('Messages retrieved', {
      messages: messages.reverse(), // chronological order
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── SEND MESSAGE (REST fallback) ──────────────
export const sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { message_type, content, reply_to, forwarded_from, expires_in } = req.body;

    // Verify conversation and not blocked
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        OR: [
          { participant_1: userId },
          { participant_2: userId },
        ],
      },
    });

    if (!conversation) throw ApiError.notFound('Conversation not found');
    if (conversation.is_blocked) throw ApiError.forbidden('Conversation is blocked');

    // Handle file upload
    let messageContent = content || {};
    if (req.file) {
      messageContent.media_url = req.file.path || req.file.secure_url || req.file.url;
      messageContent.media_type = req.file.mimetype;
      messageContent.media_size = req.file.size;
      messageContent.file_name = req.file.originalname;
    }

    const messageData = {
      conversation_id: id,
      conversation_type: conversation.type,
      sender_id: userId,
      message_type: message_type || 'text',
      content: messageContent,
      reply_to: reply_to || null,
      forwarded_from: forwarded_from || null,
    };

    // Disappearing messages
    if (expires_in) {
      const expiresMap = { '1h': 3600, '24h': 86400, '7d': 604800 };
      const seconds = expiresMap[expires_in] || parseInt(expires_in, 10);
      if (seconds) {
        messageData.expires_at = new Date(Date.now() + seconds * 1000);
      }
    }

    const message = await Message.create(messageData);

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id },
      data: { updated_at: new Date() },
    });

    // Populate reply_to for response
    const populated = await Message.findById(message._id)
      .populate('reply_to', 'content sender_id message_type')
      .lean();

    return ApiResponse.created('Message sent', populated).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GET MEDIA GALLERY ─────────────────────────
export const getMediaGallery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const { type } = req.query; // image, video, audio, file

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        OR: [
          { participant_1: userId },
          { participant_2: userId },
        ],
      },
    });

    if (!conversation) throw ApiError.notFound('Conversation not found');

    const typeFilter = type
      ? { message_type: type }
      : { message_type: { $in: ['image', 'video', 'audio', 'file'] } };

    const media = await Message.find({
      conversation_id: id,
      ...typeFilter,
      is_deleted: false,
      deleted_for_all: false,
      deleted_for: { $ne: userId },
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .select('content message_type sender_id created_at')
      .lean();

    return ApiResponse.ok('Media gallery', media).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── SEARCH MESSAGES ───────────────────────────
export const searchMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { q } = req.query;
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

    if (!q || q.length < 2) throw ApiError.badRequest('Search query must be at least 2 characters');

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        OR: [{ participant_1: userId }, { participant_2: userId }],
      },
    });

    if (!conversation) throw ApiError.notFound('Conversation not found');

    const messages = await Message.find({
      conversation_id: id,
      'content.text': { $regex: q, $options: 'i' },
      is_deleted: false,
      deleted_for_all: false,
      deleted_for: { $ne: userId },
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return ApiResponse.ok('Search results', messages).send(res);
  } catch (err) {
    next(err);
  }
};
