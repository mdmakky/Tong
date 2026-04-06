import { prisma } from '../config/database.js';
import { sanitizeUser, getPagination } from '../utils/helpers.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

// ─── GET MY PROFILE ────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    return ApiResponse.ok('Profile retrieved', sanitizeUser(user)).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── UPDATE PROFILE ────────────────────────────
export const updateMe = async (req, res, next) => {
  try {
    const allowedFields = [
      'display_name', 'bio', 'phone', 'theme_preference',
      'language', 'timezone', 'online_status', 'custom_status',
      'last_seen_visibility', 'avatar_visibility',
    ];

    const data = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }

    // Username change (check uniqueness)
    if (req.body.username && req.body.username !== req.user.username) {
      const exists = await prisma.user.findUnique({
        where: { username: req.body.username },
      });
      if (exists) throw ApiError.conflict('Username already taken');
      data.username = req.body.username;
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });

    return ApiResponse.ok('Profile updated', sanitizeUser(user)).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── UPLOAD AVATAR ─────────────────────────────
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) throw ApiError.badRequest('No image file provided');

    const avatar_url = req.file.path || req.file.secure_url || req.file.url;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar_url },
    });

    return ApiResponse.ok('Avatar updated', { avatar_url: user.avatar_url }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── SEARCH USERS ──────────────────────────────
export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) throw ApiError.badRequest('Search query must be at least 2 characters');

    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user.id } },
          { status: 'active' },
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { display_name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        display_name: true,
        avatar_url: true,
        bio: true,
        online_status: true,
        last_seen: true,
      },
      skip,
      take: limit,
      orderBy: { display_name: 'asc' },
    });

    const total = await prisma.user.count({
      where: {
        AND: [
          { id: { not: req.user.id } },
          { status: 'active' },
          {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { display_name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
    });

    return ApiResponse.ok('Search results', {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GET USER BY ID ────────────────────────────
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        display_name: true,
        avatar_url: true,
        bio: true,
        online_status: true,
        last_seen: true,
        last_seen_visibility: true,
        avatar_visibility: true,
        created_at: true,
      },
    });

    if (!user) throw ApiError.notFound('User not found');

    // Check visibility settings
    const isContact = await prisma.contact.findUnique({
      where: {
        owner_id_contact_id: { owner_id: user.id, contact_id: req.user.id },
      },
    });

    const profile = { ...user };

    // Apply last_seen visibility
    if (user.last_seen_visibility === 'nobody') {
      profile.last_seen = null;
    } else if (user.last_seen_visibility === 'contacts' && !isContact) {
      profile.last_seen = null;
    }

    // Apply avatar visibility
    if (user.avatar_visibility === 'nobody') {
      profile.avatar_url = null;
    } else if (user.avatar_visibility === 'contacts' && !isContact) {
      profile.avatar_url = null;
    }

    delete profile.last_seen_visibility;
    delete profile.avatar_visibility;

    return ApiResponse.ok('User profile', profile).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── BLOCK USER ────────────────────────────────
export const blockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) throw ApiError.badRequest('Cannot block yourself');

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw ApiError.notFound('User not found');

    await prisma.userBlock.upsert({
      where: {
        blocker_id_blocked_id: { blocker_id: req.user.id, blocked_id: id },
      },
      create: { blocker_id: req.user.id, blocked_id: id },
      update: {},
    });

    // Also block the conversation if exists
    const conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { participant_1: req.user.id, participant_2: id },
          { participant_1: id, participant_2: req.user.id },
        ],
      },
    });

    if (conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { is_blocked: true, blocked_by: req.user.id },
      });
    }

    return ApiResponse.ok('User blocked').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── UNBLOCK USER ──────────────────────────────
export const unblockUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.userBlock.deleteMany({
      where: { blocker_id: req.user.id, blocked_id: id },
    });

    // Unblock conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        blocked_by: req.user.id,
        OR: [
          { participant_1: req.user.id, participant_2: id },
          { participant_1: id, participant_2: req.user.id },
        ],
      },
    });

    if (conversation) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { is_blocked: false, blocked_by: null },
      });
    }

    return ApiResponse.ok('User unblocked').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── REPORT USER ───────────────────────────────
export const reportUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, details } = req.body;

    if (id === req.user.id) throw ApiError.badRequest('Cannot report yourself');

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw ApiError.notFound('User not found');

    await prisma.userReport.create({
      data: {
        reporter_id: req.user.id,
        reported_id: id,
        reason,
        details: details || null,
      },
    });

    return ApiResponse.created('Report submitted').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── GET MY DEVICES ────────────────────────────
export const getMyDevices = async (req, res, next) => {
  try {
    const devices = await prisma.userDevice.findMany({
      where: { user_id: req.user.id },
      select: {
        id: true,
        device_name: true,
        device_type: true,
        ip_address: true,
        last_active: true,
        created_at: true,
      },
      orderBy: { last_active: 'desc' },
    });

    return ApiResponse.ok('Devices retrieved', devices).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── REMOVE DEVICE ─────────────────────────────
export const removeDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.params;

    const device = await prisma.userDevice.findFirst({
      where: { id: deviceId, user_id: req.user.id },
    });

    if (!device) throw ApiError.notFound('Device not found');

    // Blacklist the refresh token of that device
    if (device.refresh_token) {
      const { blacklistToken } = await import('../services/token.service.js');
      await blacklistToken(device.refresh_token);
    }

    await prisma.userDevice.delete({ where: { id: deviceId } });

    return ApiResponse.ok('Device removed').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── DELETE ACCOUNT ────────────────────────────
export const deleteAccount = async (req, res, next) => {
  try {
    // Soft delete — 30 day grace period
    await prisma.user.update({
      where: { id: req.user.id },
      data: { status: 'deleted' },
    });

    return ApiResponse.ok('Account marked for deletion. You have 30 days to recover.').send(res);
  } catch (err) {
    next(err);
  }
};
