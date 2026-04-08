import { prisma } from '../config/database.js';
import Message from '../models/Message.js';
import { getPagination } from '../utils/helpers.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

const parseMessageContent = (content) => {
  if (content === undefined || content === null || content === '') return {};
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') return parsed;
      return { text: content };
    } catch (_) {
      return { text: content };
    }
  }
  return content;
};

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

    // Batch-fetch friend requests (avoids N+1 across all conversations)
    const participantIds = conversations.map((conv) =>
      conv.participant_1 === userId ? conv.participant_2 : conv.participant_1
    );
    const friendRequests = participantIds.length > 0
      ? await prisma.friendRequest.findMany({
          where: {
            OR: [
              { sender_id: userId, receiver_id: { in: participantIds } },
              { sender_id: { in: participantIds }, receiver_id: userId },
            ],
          },
          select: { id: true, status: true, sender_id: true, receiver_id: true },
        })
      : [];
    const reqMap = {};
    for (const req of friendRequests) {
      const otherId = req.sender_id === userId ? req.receiver_id : req.sender_id;
      reqMap[otherId] = req;
    }

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

        const friendReq = reqMap[otherUser?.id];
        return {
          id: conv.id,
          type: conv.type,
          is_blocked: conv.is_blocked,
          blocked_by: conv.blocked_by,
          other_user: otherUser,
          last_message: lastMessage || null,
          unread_count: unreadCount,
          request_status: friendReq?.status || null,
          request_id: friendReq?.id || null,
          request_sender_id: friendReq?.sender_id || null,
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
    const userSelect = { id: true, username: true, display_name: true, avatar_url: true };
    const existing = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant_1: userId, participant_2: participant_id },
          { participant_1: participant_id, participant_2: userId },
        ],
      },
      include: {
        user1: { select: userSelect },
        user2: { select: userSelect },
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

    // Create friend request unless already friends
    const existingFriendship = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { sender_id: userId, receiver_id: participant_id, status: 'accepted' },
          { sender_id: participant_id, receiver_id: userId, status: 'accepted' },
        ],
      },
    });
    let requestStatus = 'accepted';
    if (!existingFriendship) {
      await prisma.friendRequest.upsert({
        where: { sender_id_receiver_id: { sender_id: userId, receiver_id: participant_id } },
        create: { sender_id: userId, receiver_id: participant_id, status: 'pending' },
        update: {},
      });
      requestStatus = 'pending';
    }

    // Notify the other participant via socket
    const io = req.app.get('io');
    if (io) {
      const convForOther = {
        id: conversation.id,
        type: conversation.type,
        other_user: conversation.user1, // user1 = creator; for B, their "other" is user1 (A)
        last_message: null,
        unread_count: 0,
        request_status: requestStatus,
        request_sender_id: userId,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      };
      io.to(`user:${participant_id}`).emit('new_conversation', convForOther);
    }

    return ApiResponse.created('Conversation created', {
      ...conversation,
      request_status: requestStatus,
      request_sender_id: userId,
    }).send(res);
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

// ─── ACCEPT FRIEND REQUEST ─────────────────────
export const acceptFriendRequest = async (req, res, next) => {
  try {
    const { id: convId } = req.params;
    const userId = req.user.id;

    const conv = await prisma.conversation.findFirst({
      where: { id: convId, OR: [{ participant_1: userId }, { participant_2: userId }] },
      select: { participant_1: true, participant_2: true },
    });
    if (!conv) throw ApiError.notFound('Conversation not found');

    const otherUserId = conv.participant_1 === userId ? conv.participant_2 : conv.participant_1;

    const friendReq = await prisma.friendRequest.findFirst({
      where: { sender_id: otherUserId, receiver_id: userId, status: 'pending' },
    });
    if (!friendReq) throw ApiError.notFound('No pending request found');

    await prisma.friendRequest.update({
      where: { id: friendReq.id },
      data: { status: 'accepted' },
    });

    // Notify requester
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${otherUserId}`).emit('friend_request_accepted', { conversation_id: convId });
    }

    return ApiResponse.ok('Request accepted').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── DECLINE FRIEND REQUEST ────────────────────
export const declineFriendRequest = async (req, res, next) => {
  try {
    const { id: convId } = req.params;
    const userId = req.user.id;

    const conv = await prisma.conversation.findFirst({
      where: { id: convId, OR: [{ participant_1: userId }, { participant_2: userId }] },
      select: { participant_1: true, participant_2: true },
    });
    if (!conv) throw ApiError.notFound('Conversation not found');

    const otherUserId = conv.participant_1 === userId ? conv.participant_2 : conv.participant_1;

    await prisma.friendRequest.updateMany({
      where: { sender_id: otherUserId, receiver_id: userId, status: 'pending' },
      data: { status: 'rejected' },
    });

    await prisma.conversation.delete({ where: { id: convId } });

    // Notify requester the request was declined
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${otherUserId}`).emit('friend_request_declined', { conversation_id: convId });
    }

    return ApiResponse.ok('Request declined').send(res);
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
    const offsetParam = Number(req.query.offset);
    const effectiveSkip = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : skip;

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
      .skip(before ? 0 : effectiveSkip)
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
    let messageContent = parseMessageContent(content);
    if (req.file) {
      messageContent.media_url = req.file.path || req.file.secure_url || req.file.url;
      messageContent.media_type = req.file.mimetype;
      messageContent.media_size = req.file.size;
      messageContent.file_name = req.file.originalname;
    }

    const messageData = {
      conversation_id: id,
      conversation_type: conversation.type === 'private_encrypted' ? 'private' : 'direct',
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

    populated.sender = {
      id: req.user.id,
      username: req.user.username,
      display_name: req.user.display_name,
      avatar_url: req.user.avatar_url,
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${id}`).emit('new_message', populated);
    }

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
