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

const hmgetPresence = async (redis, userIds = []) => {
  if (!redis || userIds.length === 0) return [];

  if (typeof redis.hmget === 'function') {
    return redis.hmget('presence', ...userIds);
  }

  if (typeof redis.hMGet === 'function') {
    return redis.hMGet('presence', userIds);
  }

  return [];
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

      if (requestedIds.length === 0) {
        callback?.({ presence: presenceData });
        return;
      }

      const unresolvedIds = [];

      if (redis) {
        const cachedValues = await hmgetPresence(redis, requestedIds);

        requestedIds.forEach((uid, idx) => {
          const cached = cachedValues?.[idx];
          if (!cached) {
            unresolvedIds.push(uid);
            return;
          }

          try {
            const parsed = JSON.parse(cached);
            const normalized = normalizeStatus(parsed.status);
            presenceData[uid] = {
              status: normalized === 'invisible' ? 'offline' : normalized,
              last_seen: parsed.last_seen || null,
            };
          } catch (_) {
            // Ignore malformed Redis presence value and fall back to DB/socket state.
            unresolvedIds.push(uid);
          }
        });
      } else {
        unresolvedIds.push(...requestedIds);
      }

      if (unresolvedIds.length > 0) {
        const [users, socketCounts] = await Promise.all([
          prisma.user.findMany({
            where: { id: { in: unresolvedIds } },
            select: { id: true, online_status: true, last_seen: true },
          }),
          Promise.all(
            unresolvedIds.map(async (uid) => {
              try {
                const activeSockets = await io.in(`user:${uid}`).fetchSockets();
                return [uid, activeSockets.length];
              } catch (_) {
                return [uid, 0];
              }
            })
          ),
        ]);

        const userMap = new Map(users.map((u) => [u.id, u]));
        const socketCountMap = new Map(socketCounts);

        unresolvedIds.forEach((uid) => {
          const user = userMap.get(uid);
          if (!user) return;

          const normalized = normalizeStatus(user.online_status);
          const activeSocketCount = socketCountMap.get(uid) || 0;
          const resolvedStatus = activeSocketCount === 0
            ? 'offline'
            : (normalized === 'invisible' ? 'offline' : normalized);

          presenceData[uid] = {
            status: resolvedStatus,
            last_seen: user.last_seen || null,
          };
        });
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
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      if (sockets.length > 0) return;

      const now = new Date();
      const redis = getRedis();
      if (redis) {
        await redis.hset('presence', userId, JSON.stringify({
          status: 'offline',
          socket_id: null,
          last_seen: now.toISOString(),
        }));
      }

      // Preserve user-selected profile status; only update last_seen timestamp.
      await prisma.user.update({
        where: { id: userId },
        data: { last_seen: now },
      });

      socket.broadcast.emit('presence_update', {
        user_id: userId,
        status: 'offline',
        last_seen: now,
      });
    } catch (err) {
      console.error('presence disconnect error:', err.message);
    }
  });
};

export default presenceHandler;
