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
    if (member_ids && Array.isArray(member_ids)) {
      const validMembers = member_ids.filter((id) => id !== req.user.id).slice(0, 255);
      if (validMembers.length > 0) {
        await prisma.groupMember.createMany({
          data: validMembers.map((user_id) => ({
            group_id: group.id,
            user_id,
            role: 'member',
          })),
          skipDuplicates: true,
        });
      }
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

    await prisma.group.delete({ where: { id } });

    // Delete all messages from MongoDB
    await Message.deleteMany({ conversation_id: id, conversation_type: 'group' });

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
      select: { id: true, display_name: true, status: true },
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

    await prisma.groupMember.create({
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

    return ApiResponse.ok('Joined group successfully', group).send(res);
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
      } else {
        // Last member — delete group
        await prisma.group.delete({ where: { id } });
        await Message.deleteMany({ conversation_id: id });
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

    const messages = await Message.find({
      conversation_id: id,
      conversation_type: 'group',
      is_deleted: false,
      deleted_for_all: false,
      deleted_for: { $ne: req.user.id },
    })
      .sort({ created_at: -1 })
      .skip(skip)
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
    if (is_announcement && !['owner', 'admin'].includes(member.role)) {
      throw ApiError.forbidden('Only admins can send announcements');
    }

    let messageContent = content || {};
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
      reply_to: reply_to || null,
      is_announcement: is_announcement || false,
      mentions: mentions || [],
    });

    const populated = await Message.findById(message._id)
      .populate('reply_to', 'content sender_id message_type')
      .lean();

    return ApiResponse.created('Message sent', populated).send(res);
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
