import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { prisma } from '../config/database.js';
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
  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user.display_name} (${socket.user.id})`);

    // Join user's personal room for direct notifications
    socket.join(`user:${socket.user.id}`);

    // Register all event handlers
    chatHandler(io, socket);
    presenceHandler(io, socket);
    groupHandler(io, socket);

    // ─── Disconnect ───
    socket.on('disconnect', async (reason) => {
      console.log(`🔌 User disconnected: ${socket.user.display_name} — ${reason}`);

      // Update last_seen
      try {
        await prisma.user.update({
          where: { id: socket.user.id },
          data: { last_seen: new Date(), online_status: 'offline' },
        });

        // Broadcast offline status
        socket.broadcast.emit('presence_update', {
          user_id: socket.user.id,
          status: 'offline',
          last_seen: new Date(),
        });
      } catch (err) {
        console.error('Disconnect update error:', err.message);
      }
    });

    // ─── Error ───
    socket.on('error', (err) => {
      console.error(`Socket error for ${socket.user.id}:`, err.message);
    });
  });

  return io;
};

export default initializeSocket;
