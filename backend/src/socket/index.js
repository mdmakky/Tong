import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { prisma } from '../config/database.js';
import Message from '../models/Message.js';
import chatHandler from './chatHandler.js';
import presenceHandler from './presenceHandler.js';
import groupHandler from './groupHandler.js';

/**
 * Initialize Socket.io server with JWT authentication
 */
const initializeSocket = (io) => {
  // ─── Authentication Middleware ───
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          display_name: true,
          avatar_url: true,
          status: true,
          online_status: true,
        },
      });

      if (!user || user.status !== 'active') {
        return next(new Error('User not found or inactive'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection Handler ───
  io.on('connection', async (socket) => {
    console.log(`🔌 User connected: ${socket.user.display_name} (${socket.user.id})`);

    // Join user's personal room for direct notifications
    socket.join(`user:${socket.user.id}`);

    // Auto-join all existing conversation rooms so messages arrive in real-time
    try {
      const convs = await prisma.conversation.findMany({
        where: {
          OR: [
            { participant_1: socket.user.id },
            { participant_2: socket.user.id },
          ],
        },
        select: { id: true },
      });
      convs.forEach(({ id }) => socket.join(`conv:${id}`));
    } catch (_) {}

    // ── Auto-deliver pending messages ────────────────────────────────
    // When a user comes online, mark all undelivered messages TO them as delivered
    // and notify each sender in real-time.
    try {
      const myUserId = socket.user.id;
      const myConvIds = (await prisma.conversation.findMany({
        where: { OR: [{ participant_1: myUserId }, { participant_2: myUserId }] },
        select: { id: true },
      })).map((c) => c.id);

      if (myConvIds.length > 0) {
        const relevant = await Message.find({
          conversation_type: { $in: ['direct'] },
          conversation_id: { $in: myConvIds },
          sender_id: { $ne: myUserId },
          delivered_to: { $ne: myUserId },
          is_deleted: false,
          deleted_for_all: false,
        })
          .select('_id conversation_id sender_id')
          .lean();

        if (relevant.length > 0) {
          const msgIds = relevant.map((m) => m._id);
          await Message.updateMany(
            { _id: { $in: msgIds } },
            { $addToSet: { delivered_to: myUserId } }
          );

          // Group by sender and notify each sender
          const bySender = {};
          for (const m of relevant) {
            if (!bySender[m.sender_id]) bySender[m.sender_id] = [];
            bySender[m.sender_id].push({
              message_id: m._id.toString(),
              conversation_id: m.conversation_id,
            });
          }

          for (const [senderId, msgs] of Object.entries(bySender)) {
            for (const { message_id, conversation_id } of msgs) {
              io.to(`user:${senderId}`).emit('message_delivered', {
                message_id,
                conversation_id,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Auto-deliver error:', err.message);
    }

    // Register all event handlers
    chatHandler(io, socket);
    presenceHandler(io, socket);
    groupHandler(io, socket);

    // ─── Disconnect ───
    socket.on('disconnect', (reason) => {
      console.log(`🔌 User disconnected: ${socket.user.display_name} — ${reason}`);
    });

    // ─── Error ───
    socket.on('error', (err) => {
      console.error(`Socket error for ${socket.user.id}:`, err.message);
    });
  });

  return io;
};

export default initializeSocket;
