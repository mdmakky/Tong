import { prisma } from '../config/database.js';
import { getRedis } from '../config/database.js';

/**
 * Presence (online status) handler
 * Tracks online/offline/away/busy/invisible status via Redis and Socket.io
 */
const presenceHandler = (io, socket) => {
  const userId = socket.user.id;

  // ─── Set Online on Connect ───
  const setOnline = async () => {
    try {
      const redis = getRedis();
      if (redis) {
        await redis.hset('presence', userId, JSON.stringify({
          status: socket.user.online_status || 'online',
          socket_id: socket.id,
          last_seen: new Date().toISOString(),
        }));
      }

      // Update DB
      await prisma.user.update({
        where: { id: userId },
        data: { online_status: socket.user.online_status || 'online', last_seen: new Date() },
      });

      // Broadcast to others (not if invisible)
      if (socket.user.online_status !== 'invisible') {
        socket.broadcast.emit('presence_update', {
          user_id: userId,
          status: socket.user.online_status || 'online',
          last_seen: new Date(),
        });
      }
    } catch (err) {
      console.error('setOnline error:', err.message);
    }
  };

  setOnline();

  // ─── UPDATE PRESENCE ─────────────────────────
  socket.on('update_presence', async ({ status }) => {
    try {
      const validStatuses = ['online', 'away', 'busy', 'invisible'];
      if (!validStatuses.includes(status)) return;

      const redis = getRedis();
      if (redis) {
        await redis.hset('presence', userId, JSON.stringify({
          status,
          socket_id: socket.id,
          last_seen: new Date().toISOString(),
        }));
      }

      await prisma.user.update({
        where: { id: userId },
        data: { online_status: status, last_seen: new Date() },
      });

      // Broadcast (not if invisible)
      if (status !== 'invisible') {
        socket.broadcast.emit('presence_update', {
          user_id: userId,
          status,
          last_seen: new Date(),
        });
      } else {
        // If going invisible, broadcast as offline
        socket.broadcast.emit('presence_update', {
          user_id: userId,
          status: 'offline',
          last_seen: new Date(),
        });
      }
    } catch (err) {
      console.error('update_presence error:', err.message);
    }
  });

  // ─── GET PRESENCE (request online status of specific users) ───
  socket.on('get_presence', async ({ user_ids }, callback) => {
    try {
      const redis = getRedis();
      const presenceData = {};

      if (redis && user_ids?.length) {
        for (const uid of user_ids) {
          const data = await redis.hget('presence', uid);
          if (data) {
            const parsed = JSON.parse(data);
            presenceData[uid] = {
              status: parsed.status === 'invisible' ? 'offline' : parsed.status,
              last_seen: parsed.last_seen,
            };
          } else {
            // Check DB as fallback
            const user = await prisma.user.findUnique({
              where: { id: uid },
              select: { online_status: true, last_seen: true },
            });
            if (user) {
              presenceData[uid] = {
                status: user.online_status === 'invisible' ? 'offline' : (user.online_status || 'offline'),
                last_seen: user.last_seen,
              };
            }
          }
        }
      }

      callback?.({ presence: presenceData });
    } catch (err) {
      console.error('get_presence error:', err.message);
      callback?.({ presence: {} });
    }
  });

  // ─── Cleanup on Disconnect ───
  socket.on('disconnect', async () => {
    try {
      const redis = getRedis();
      if (redis) {
        // Check if user has other active sockets
        const sockets = await io.in(`user:${userId}`).fetchSockets();
        if (sockets.length === 0) {
          // Last socket — set offline
          await redis.hset('presence', userId, JSON.stringify({
            status: 'offline',
            socket_id: null,
            last_seen: new Date().toISOString(),
          }));
        }
      }
    } catch (err) {
      console.error('presence disconnect error:', err.message);
    }
  });
};

export default presenceHandler;
