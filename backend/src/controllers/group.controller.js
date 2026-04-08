import { prisma } from '../config/database.js';
import Message from '../models/Message.js';
import { generateInviteLink, getPagination } from '../utils/helpers.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

// ─── HELPERS ───────────────────────────────────
const checkGroupPermission = async (groupId, userId, requiredRoles) => {
  const member = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: groupId, user_id: userId } },
  });
  if (!member) throw ApiError.forbidden('You are not a member of this group');
  if (requiredRoles && !requiredRoles.includes(member.role)) {
    throw ApiError.forbidden(`Requires ${requiredRoles.join(' or ')} role`);
  }
  return member;
};

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

const parseStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
};

const emitToGroupRoom = (req, groupId, event, payload) => {
  const io = req.app.get('io');
  if (io) io.to(`conv:${groupId}`).emit(event, payload);
};

const emitToUserRoom = (req, userId, event, payload) => {
  const io = req.app.get('io');
  if (io) io.to(`user:${userId}`).emit(event, payload);
};

const removeUserFromGroupRoom = (req, userId, groupId) => {
  const io = req.app.get('io');
  if (io) io.in(`user:${userId}`).socketsLeave(`conv:${groupId}`);
};

// ─── GET MY GROUPS ─────────────────────────────
export const getGroups = async (req, res, next) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { user_id: req.user.id },
      include: {
        group: {
          include: {
            owner: {
              select: { id: true, username: true, display_name: true, avatar_url: true },
            },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joined_at: 'desc' },
    });

    const groups = await Promise.all(
      memberships.map(async (m) => {
        const lastMessage = await Message.findOne({
          conversation_id: m.group_id,
          conversation_type: 'group',
          is_deleted: false,
          deleted_for_all: false,
        })
          .sort({ created_at: -1 })
          .select('content message_type sender_id created_at')
          .lean();

        const unreadCount = m.last_read_at
          ? await Message.countDocuments({
              conversation_id: m.group_id,
              conversation_type: 'group',
              created_at: { $gt: m.last_read_at },
              sender_id: { $ne: req.user.id },
            })
          : 0;

        return {
          ...m.group,
          my_role: m.role,
          nickname: m.nickname,
          muted_until: m.muted_until,
          last_message: lastMessage,
          unread_count: unreadCount,
        };
      })
    );

    return ApiResponse.ok('Groups retrieved', groups).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── CREATE GROUP ──────────────────────────────
export const createGroup = async (req, res, next) => {
  try {
    const { name, description, type, max_members, is_invite_only, member_ids } = req.body;
    const initialMemberIds = Array.isArray(member_ids)
      ? member_ids.filter((id) => id !== req.user.id).slice(0, 255)
      : [];

    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        type: type || 'private',
        owner_id: req.user.id,
        max_members: max_members || 256,
        is_invite_only: is_invite_only || false,
        invite_link: generateInviteLink(),
      },
    });

    // Add owner as member
    await prisma.groupMember.create({
      data: {
        group_id: group.id,
        user_id: req.user.id,
        role: 'owner',
      },
    });

    // Add initial members
    if (initialMemberIds.length > 0) {
        await prisma.groupMember.createMany({
          data: initialMemberIds.map((user_id) => ({
            group_id: group.id,
            user_id,
            role: 'member',
          })),
          skipDuplicates: true,
        });
    }

    // System message
    await Message.create({
      conversation_id: group.id,
      conversation_type: 'group',
      sender_id: req.user.id,
      message_type: 'system',
      content: { text: `${req.user.display_name} created the group "${name}"` },
    });

    const created = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        owner: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        _count: { select: { members: true } },
      },
    });

    for (const memberId of initialMemberIds) {
      emitToUserRoom(req, memberId, 'new_conversation', {
        type: 'group',
        group: {
          ...created,
          my_role: 'member',
        },
      });
    }

    return ApiResponse.created('Group created', created).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GET GROUP ─────────────────────────────────
export const getGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        _count: { select: { members: true } },
      },
    });

    if (!group) throw ApiError.notFound('Group not found');

    // Check if user is member or group is public
    const isMember = await prisma.groupMember.findUnique({
      where: { group_id_user_id: { group_id: id, user_id: req.user.id } },
    });

    if (!isMember && group.type !== 'public') {
      throw ApiError.forbidden('You are not a member of this group');
    }

    return ApiResponse.ok('Group retrieved', { ...group, my_role: isMember?.role || null }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE GROUP ──────────────────────────────
export const updateGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    await checkGroupPermission(id, req.user.id, ['owner', 'admin']);

    const allowedFields = ['name', 'description', 'type', 'max_members', 'is_invite_only', 'message_retention_days'];
    const data = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    // Handle avatar upload
    if (req.file) {
      data.avatar_url = req.file.path || req.file.secure_url || req.file.url;
    }

    const group = await prisma.group.update({
      where: { id },
      data,
    });

    emitToGroupRoom(req, id, 'group_updated', {
      group_id: id,
      changes: group,
      updated_by: req.user.id,
    });

    return ApiResponse.ok('Group updated', group).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE GROUP ──────────────────────────────
export const deleteGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    await checkGroupPermission(id, req.user.id, ['owner']);

    const members = await prisma.groupMember.findMany({
      where: { group_id: id },
      select: { user_id: true },
    });

    await prisma.group.delete({ where: { id } });

    // Delete all messages from MongoDB
    await Message.deleteMany({ conversation_id: id, conversation_type: 'group' });

    for (const member of members) {
      emitToUserRoom(req, member.user_id, 'removed_from_group', { group_id: id });
      removeUserFromGroupRoom(req, member.user_id, id);
    }

    emitToGroupRoom(req, id, 'group_deleted', { group_id: id });

    return ApiResponse.ok('Group deleted').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GET MEMBERS ───────────────────────────────
export const getMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    await checkGroupPermission(id, req.user.id, ['owner', 'admin', 'moderator', 'member']);

    const members = await prisma.groupMember.findMany({
      where: { group_id: id },
      include: {
        user: {
          select: { id: true, username: true, display_name: true, avatar_url: true, online_status: true, last_seen: true },
        },
      },
      orderBy: [
        { role: 'asc' }, // owner first, then admin, etc.
        { joined_at: 'asc' },
      ],
    });

    return ApiResponse.ok('Members retrieved', members).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── ADD MEMBER ────────────────────────────────
export const addMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    await checkGroupPermission(id, req.user.id, ['owner', 'admin']);

    const group = await prisma.group.findUnique({ where: { id } });
    const memberCount = await prisma.groupMember.count({ where: { group_id: id } });

    if (memberCount >= group.max_members) {
      throw ApiError.badRequest(`Group is full (max ${group.max_members} members)`);
    }

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: { id: true, username: true, display_name: true, avatar_url: true, status: true },
    });
    if (!user || user.status !== 'active') throw ApiError.notFound('User not found');

    await prisma.groupMember.create({
      data: { group_id: id, user_id, role: 'member' },
    });

    // System message
    await Message.create({
      conversation_id: id,
      conversation_type: 'group',
      sender_id: req.user.id,
      message_type: 'system',
      content: { text: `${req.user.display_name} added ${user.display_name}` },
    });

    const groupSummary = await prisma.group.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        _count: { select: { members: true } },
      },
    });

    emitToGroupRoom(req, id, 'member_joined', {
      group_id: id,
      user,
      added_by: req.user.id,
    });

    emitToUserRoom(req, user_id, 'new_conversation', {
      type: 'group',
      group: {
        ...groupSummary,
        my_role: 'member',
      },
    });

    return ApiResponse.created('Member added').send(res);
  } catch (err) {
    if (err.code === 'P2002') return next(ApiError.conflict('User is already a member'));
    next(err);
  }
};

// ─── REMOVE MEMBER ─────────────────────────────
export const removeMember = async (req, res, next) => {
  try {
    const { id, uid } = req.params;
    const requester = await checkGroupPermission(id, req.user.id, ['owner', 'admin']);

    // Can't remove owner
    const target = await prisma.groupMember.findUnique({
      where: { group_id_user_id: { group_id: id, user_id: uid } },
    });

    if (!target) throw ApiError.notFound('Member not found');
    if (target.role === 'owner') throw ApiError.forbidden('Cannot remove the group owner');
    if (target.role === 'admin' && requester.role !== 'owner') {
      throw ApiError.forbidden('Only owner can remove admins');
    }

    await prisma.groupMember.delete({
      where: { group_id_user_id: { group_id: id, user_id: uid } },
    });

    await Message.create({
      conversation_id: id,
      conversation_type: 'group',
      sender_id: req.user.id,
      message_type: 'system',
      content: { text: `${req.user.display_name} removed a member` },
    });

    emitToGroupRoom(req, id, 'member_left', {
      group_id: id,
      user_id: uid,
      removed_by: req.user.id,
    });

    emitToUserRoom(req, uid, 'removed_from_group', { group_id: id });
    removeUserFromGroupRoom(req, uid, id);

    return ApiResponse.ok('Member removed').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE MEMBER ROLE ────────────────────────
export const updateMemberRole = async (req, res, next) => {
  try {
    const { id, uid } = req.params;
    const { role } = req.body;

    await checkGroupPermission(id, req.user.id, ['owner', 'admin']);

    if (!['admin', 'moderator', 'member'].includes(role)) {
      throw ApiError.badRequest('Invalid role');
    }

    // Only owner can promote to admin
    if (role === 'admin') {
      await checkGroupPermission(id, req.user.id, ['owner']);
    }

    await prisma.groupMember.update({
      where: { group_id_user_id: { group_id: id, user_id: uid } },
      data: { role },
    });

    emitToGroupRoom(req, id, 'member_role_updated', {
      group_id: id,
      user_id: uid,
      role,
      updated_by: req.user.id,
    });

    return ApiResponse.ok('Role updated').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── JOIN VIA INVITE LINK ──────────────────────
export const joinByInvite = async (req, res, next) => {
  try {
    const { invite_link } = req.params;

    const group = await prisma.group.findUnique({
      where: { invite_link },
    });

    if (!group) throw ApiError.notFound('Invalid invite link');

    // Check member count
    const memberCount = await prisma.groupMember.count({ where: { group_id: group.id } });
    if (memberCount >= group.max_members) {
      throw ApiError.badRequest('Group is full');
    }

    // Check if already member
    const existing = await prisma.groupMember.findUnique({
      where: { group_id_user_id: { group_id: group.id, user_id: req.user.id } },
    });

    if (existing) {
      return ApiResponse.ok('You are already a member', group).send(res);
    }

    const newMember = await prisma.groupMember.create({
      data: { group_id: group.id, user_id: req.user.id, role: 'member' },
    });

    // System message
    await Message.create({
      conversation_id: group.id,
      conversation_type: 'group',
      sender_id: req.user.id,
      message_type: 'system',
      content: { text: `${req.user.display_name} joined via invite link` },
    });

    const joined = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        owner: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        _count: { select: { members: true } },
      },
    });

    emitToGroupRoom(req, group.id, 'member_joined', {
      group_id: group.id,
      user: {
        id: req.user.id,
        username: req.user.username,
        display_name: req.user.display_name,
        avatar_url: req.user.avatar_url,
      },
      added_by: req.user.id,
    });

    return ApiResponse.ok('Joined group successfully', {
      ...joined,
      my_role: newMember.role,
    }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── LEAVE GROUP ───────────────────────────────
export const leaveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const member = await checkGroupPermission(id, req.user.id, ['owner', 'admin', 'moderator', 'member']);

    if (member.role === 'owner') {
      // Transfer ownership to the next admin, or oldest member
      const nextOwner = await prisma.groupMember.findFirst({
        where: { group_id: id, user_id: { not: req.user.id } },
        orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
      });

      if (nextOwner) {
        await prisma.groupMember.update({
          where: { id: nextOwner.id },
          data: { role: 'owner' },
        });
        await prisma.group.update({
          where: { id },
          data: { owner_id: nextOwner.user_id },
        });

        emitToGroupRoom(req, id, 'group_updated', {
          group_id: id,
          changes: { owner_id: nextOwner.user_id },
          updated_by: req.user.id,
        });
      } else {
        // Last member — delete group
        await prisma.group.delete({ where: { id } });
        await Message.deleteMany({ conversation_id: id });
        emitToUserRoom(req, req.user.id, 'removed_from_group', { group_id: id });
        removeUserFromGroupRoom(req, req.user.id, id);
        return ApiResponse.ok('Group deleted (you were the last member)').send(res);
      }
    }

    await prisma.groupMember.delete({
      where: { group_id_user_id: { group_id: id, user_id: req.user.id } },
    });

    // System message
    await Message.create({
      conversation_id: id,
      conversation_type: 'group',
      sender_id: req.user.id,
      message_type: 'system',
      content: { text: `${req.user.display_name} left the group` },
    });

    emitToGroupRoom(req, id, 'member_left', {
      group_id: id,
      user_id: req.user.id,
      removed_by: req.user.id,
    });

    emitToUserRoom(req, req.user.id, 'removed_from_group', { group_id: id });
    removeUserFromGroupRoom(req, req.user.id, id);

    return ApiResponse.ok('Left group').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GROUP MESSAGES ────────────────────────────
export const getGroupMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    await checkGroupPermission(id, req.user.id, ['owner', 'admin', 'moderator', 'member']);

    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const offsetParam = Number(req.query.offset);
    const effectiveSkip = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : skip;

    const messages = await Message.find({
      conversation_id: id,
      conversation_type: 'group',
      is_deleted: false,
      deleted_for_all: false,
      deleted_for: { $ne: req.user.id },
    })
      .sort({ created_at: -1 })
      .skip(effectiveSkip)
      .limit(limit)
      .populate('reply_to', 'content sender_id message_type')
      .lean();

    const total = await Message.countDocuments({
      conversation_id: id,
      conversation_type: 'group',
      is_deleted: false,
      deleted_for_all: false,
    });

    // Update last_read_at
    await prisma.groupMember.update({
      where: { group_id_user_id: { group_id: id, user_id: req.user.id } },
      data: { last_read_at: new Date() },
    });

    return ApiResponse.ok('Group messages', {
      messages: messages.reverse(),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── SEND GROUP MESSAGE ────────────────────────
export const sendGroupMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const member = await checkGroupPermission(id, req.user.id, ['owner', 'admin', 'moderator', 'member']);

    // Check if muted
    if (member.muted_until && new Date(member.muted_until) > new Date()) {
      throw ApiError.forbidden('You are muted in this group');
    }

    const { message_type, content, reply_to, is_announcement, mentions } = req.body;

    // Only admin can send announcements
    const isAnnouncement = is_announcement === true || is_announcement === 'true';
    if (isAnnouncement && !['owner', 'admin'].includes(member.role)) {
      throw ApiError.forbidden('Only admins can send announcements');
    }

    let messageContent = parseMessageContent(content);
    if (req.file) {
      messageContent.media_url = req.file.path || req.file.secure_url || req.file.url;
      messageContent.media_type = req.file.mimetype;
      messageContent.media_size = req.file.size;
      messageContent.file_name = req.file.originalname;
    }

    const message = await Message.create({
      conversation_id: id,
      conversation_type: 'group',
      sender_id: req.user.id,
      message_type: message_type || 'text',
      content: messageContent,
      reply_to: typeof reply_to === 'string' ? reply_to : (reply_to || null),
      is_announcement: isAnnouncement,
      mentions: parseStringArray(mentions),
    });

    const populated = await Message.findById(message._id)
      .populate('reply_to', 'content sender_id message_type')
      .lean();

    populated.sender = {
      id: req.user.id,
      username: req.user.username,
      display_name: req.user.display_name,
      avatar_url: req.user.avatar_url,
    };

    emitToGroupRoom(req, id, 'new_message', populated);

    return ApiResponse.created('Message sent', populated).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GROUP MEDIA GALLERY ──────────────────────
export const getGroupMedia = async (req, res, next) => {
  try {
    const { id } = req.params;
    await checkGroupPermission(id, req.user.id, ['owner', 'admin', 'moderator', 'member']);

    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const { type } = req.query;

    const typeFilter = type
      ? { message_type: type }
      : { message_type: { $in: ['image', 'video', 'audio', 'file'] } };

    const media = await Message.find({
      conversation_id: id,
      conversation_type: 'group',
      ...typeFilter,
      is_deleted: false,
      deleted_for_all: false,
      deleted_for: { $ne: req.user.id },
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .select('content message_type sender_id created_at')
      .lean();

    return ApiResponse.ok('Group media gallery', media).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── CREATE POLL ───────────────────────────────
export const createPoll = async (req, res, next) => {
  try {
    const { id } = req.params;
    await checkGroupPermission(id, req.user.id, ['owner', 'admin', 'moderator', 'member']);

    const { question, options } = req.body;
    if (!question || !options || options.length < 2) {
      throw ApiError.badRequest('Question and at least 2 options required');
    }

    const pollContent = {
      text: question,
      poll: {
        options: options.map((opt, i) => ({ id: i, text: opt, votes: [] })),
        is_closed: false,
      },
    };

    const message = await Message.create({
      conversation_id: id,
      conversation_type: 'group',
      sender_id: req.user.id,
      message_type: 'text',
      content: pollContent,
    });

    return ApiResponse.created('Poll created', message).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── MUTE MEMBER ───────────────────────────────
export const muteMember = async (req, res, next) => {
  try {
    const { id, uid } = req.params;
    const { duration } = req.body; // in minutes

    await checkGroupPermission(id, req.user.id, ['owner', 'admin', 'moderator']);

    const target = await prisma.groupMember.findUnique({
      where: { group_id_user_id: { group_id: id, user_id: uid } },
    });
    if (!target) throw ApiError.notFound('Member not found');
    if (['owner', 'admin'].includes(target.role)) {
      throw ApiError.forbidden('Cannot mute admins or owner');
    }

    const muted_until = new Date(Date.now() + (duration || 60) * 60 * 1000);

    await prisma.groupMember.update({
      where: { group_id_user_id: { group_id: id, user_id: uid } },
      data: { muted_until },
    });

    return ApiResponse.ok('Member muted', { muted_until }).send(res);
  } catch (err) {
    next(err);
  }
};
