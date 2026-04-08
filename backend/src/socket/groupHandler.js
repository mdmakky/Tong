import { prisma } from '../config/database.js';

/**
 * Group-specific socket event handlers
 */
const groupHandler = (io, socket) => {
  const userId = socket.user.id;
  const getMembership = (groupId) =>
    prisma.groupMember.findUnique({
      where: { group_id_user_id: { group_id: groupId, user_id: userId } },
      select: { role: true },
    });

  const canManageMembers = (role) => ['owner', 'admin'].includes(role);

  // ─── JOIN GROUP ROOM ─────────────────────────
  socket.on('join_group', async ({ group_id }) => {
    try {
      // Verify membership
      const member = await prisma.groupMember.findUnique({
        where: { group_id_user_id: { group_id, user_id: userId } },
      });

      if (member) {
        socket.join(`conv:${group_id}`);
        console.log(`${socket.user.display_name} joined group room: ${group_id}`);
      }
    } catch (err) {
      console.error('join_group error:', err.message);
    }
  });

  // ─── LEAVE GROUP ROOM ────────────────────────
  socket.on('leave_group', ({ group_id }) => {
    socket.leave(`conv:${group_id}`);
  });

  // ─── Emit group update to all members ────────
  socket.on('group_update', async ({ group_id, changes }) => {
    try {
      const membership = await getMembership(group_id);
      if (!membership || !canManageMembers(membership.role)) return;

      io.to(`conv:${group_id}`).emit('group_updated', {
        group_id,
        changes,
        updated_by: userId,
      });
    } catch (err) {
      console.error('group_update error:', err.message);
    }
  });

  // ─── Member joined notification ──────────────
  socket.on('member_added', async ({ group_id, user_id: newUserId }) => {
    try {
      const membership = await getMembership(group_id);
      if (!membership || !canManageMembers(membership.role)) return;

      const user = await prisma.user.findUnique({
        where: { id: newUserId },
        select: { id: true, username: true, display_name: true, avatar_url: true },
      });

      const group = await prisma.group.findUnique({
        where: { id: group_id },
        include: {
          owner: { select: { id: true, username: true, display_name: true, avatar_url: true } },
          _count: { select: { members: true } },
        },
      });

      if (user && group) {
        io.to(`conv:${group_id}`).emit('member_joined', {
          group_id,
          user,
          added_by: userId,
        });

        // Notify the new member
        io.to(`user:${newUserId}`).emit('new_conversation', {
          type: 'group',
          group: {
            ...group,
            my_role: 'member',
          },
        });
      }
    } catch (err) {
      console.error('member_added error:', err.message);
    }
  });

  // ─── Member left/removed notification ────────
  socket.on('member_removed', async ({ group_id, user_id: removedUserId }) => {
    try {
      const membership = await getMembership(group_id);
      if (!membership || !canManageMembers(membership.role)) return;

      io.to(`conv:${group_id}`).emit('member_left', {
        group_id,
        user_id: removedUserId,
        removed_by: userId,
      });

      // Notify the removed member
      io.to(`user:${removedUserId}`).emit('removed_from_group', { group_id });
    } catch (err) {
      console.error('member_removed error:', err.message);
    }
  });

  // ─── Auto-join all user's groups on connect ──
  const joinUserGroups = async () => {
    try {
      const memberships = await prisma.groupMember.findMany({
        where: { user_id: userId },
        select: { group_id: true },
      });

      for (const m of memberships) {
        socket.join(`conv:${m.group_id}`);
      }

      if (memberships.length > 0) {
        console.log(`${socket.user.display_name} auto-joined ${memberships.length} group rooms`);
      }
    } catch (err) {
      console.error('joinUserGroups error:', err.message);
    }
  };

  joinUserGroups();
};

export default groupHandler;
