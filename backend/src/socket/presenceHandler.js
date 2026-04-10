import { prisma } from '../config/database.js';
import { getRedis } from '../config/database.js';

const VALID_STATUSES = new Set(['online', 'away', 'busy', 'invisible', 'offline']);

const normalizeStatus = (status, fallback = 'offline') => {
  if (typeof status !== 'string') return fallback;
  return VALID_STATUSES.has(status) ? status : fallback;
};

const resolveConnectStatus = (status) => {
  const normalized = normalizeStatus(status, 'online');
  // Users should never remain "offline" while an active socket is connected.
  return normalized === 'offline' ? 'online' : normalized;
};

/**
 * Presence (online status) handler
 * Tracks online/offline/away/busy/invisible status via Redis and Socket.io
 */
const presenceHandler = (io, socket) => {
  const userId = socket.user.id;

  // ─── Set Online on Connect ───
  const setOnline = async () => {
    try {
      const connectStatus = resolveConnectStatus(socket.user.online_status);
      const redis = getRedis();
      if (redis) {
        await redis.hset('presence', userId, JSON.stringify({
          status: connectStatus,
          socket_id: socket.id,
          last_seen: new Date().toISOString(),
        }));
      }

      // Update DB
      await prisma.user.update({
        where: { id: userId },
        data: { online_status: connectStatus, last_seen: new Date() },
      });

      // Broadcast to others (not if invisible)
      if (connectStatus !== 'invisible') {
        socket.broadcast.emit('presence_update', {
          user_id: userId,
          status: connectStatus,
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
      const requestedIds = [...new Set((user_ids || []).filter(Boolean))];

      for (const uid of requestedIds) {
        let status = null;
        let lastSeen = null;

        if (redis) {
          const data = await redis.hget('presence', uid);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              const normalized = normalizeStatus(parsed.status);
              status = normalized === 'invisible' ? 'offline' : normalized;
              lastSeen = parsed.last_seen || null;
            } catch (_) {
              // Ignore malformed Redis presence value and fall back to DB/socket state.
            }
          }
        }

        if (!status) {
          const [activeSockets, user] = await Promise.all([
            io.in(`user:${uid}`).fetchSockets(),
            prisma.user.findUnique({
              where: { id: uid },
              select: { online_status: true, last_seen: true },
            }),
          ]);

          if (!user) continue;

          const normalized = normalizeStatus(user.online_status);
          if (activeSockets.length === 0) {
            status = 'offline';
          } else {
            status = normalized === 'invisible' ? 'offline' : normalized;
          }
          lastSeen = user.last_seen;
        }

        presenceData[uid] = {
          status: status || 'offline',
          last_seen: lastSeen || null,
        };
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
