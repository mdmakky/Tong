import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Phone, Video, Star, Users, Image, File, Link2,
  ChevronDown, ChevronRight, Shield, BellOff,
  UserMinus, UserX, UserCheck, Flag, Crown, UserCog,
  UserPlus, Trash2, Copy, Save, X
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import Avatar from '@/components/ui/Avatar'
import { groupApi, conversationApi, userApi } from '@/lib/apiServices'
import { formatLastSeen } from '@/utils/helpers'

export default function InfoPanel() {
  const { activeConversation, activeType, presenceMap } = useChatStore()
  const { user } = useAuthStore()

  if (!activeConversation) return null

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-bg-secondary">
      {activeType === 'group' ? (
        <GroupInfo conversation={activeConversation} currentUser={user} />
      ) : (
        <DirectInfo conversation={activeConversation} currentUser={user} presenceMap={presenceMap} />
      )}

      {/* Media/Files/Links sections */}
      <MediaSection conversationId={activeConversation.id} activeType={activeType} />
    </div>
  )
}

// ─── Direct chat info ─────────────────────────────────────────────────────────
function DirectInfo({ conversation, currentUser, presenceMap }) {
  const [blockLoading, setBlockLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showNicknamesModal, setShowNicknamesModal] = useState(false)
  const { upsertConversation, removeConversation, setActiveConversation, togglePinConversation, pinnedConversations, setNickname, nicknames } = useChatStore()

  const isPinned = pinnedConversations.includes(conversation.id)
  const currentNickname = nicknames[conversation.id] || ''

  const other =
    conversation.other_user ||
    (conversation.participant_1 === currentUser?.id ? conversation.user2 : conversation.user1) ||
    null

  const presence = other ? presenceMap[other?.id] : null
  const status = presence?.status || other?.online_status || 'offline'
  const lastSeen = presence?.last_seen || other?.last_seen

  const isBlockedByMe = conversation.is_blocked && conversation.blocked_by === currentUser?.id

  // Load nickname on mount
  useEffect(() => {
    const loadNickname = async () => {
      try {
        const { data } = await conversationApi.getNickname(conversation.id)
        const nickname = data?.data?.nickname || ''
        setNickname(conversation.id, nickname)
      } catch (_) {
        // Silently fail if not found
      }
    }
    if (conversation?.id) {
      loadNickname()
    }
  }, [conversation?.id, setNickname])

  const handleBlock = async () => {
    if (!other?.id) return
    setBlockLoading(true)
    try {
      if (isBlockedByMe) {
        await userApi.unblock(other.id)
        upsertConversation({ id: conversation.id, is_blocked: false, blocked_by: null })
        toast.success('User unblocked')
      } else {
        await userApi.block(other.id)
        upsertConversation({ id: conversation.id, is_blocked: true, blocked_by: currentUser?.id })
        toast.success('User blocked')
      }
    } catch (_) {
      toast.error('Failed — please try again')
    } finally {
      setBlockLoading(false)
    }
  }

  const handleDeleteConversation = async () => {
    if (deleteLoading) return

    const confirmed = window.confirm('Delete this conversation for you?')
    if (!confirmed) return

    setDeleteLoading(true)
    try {
      await conversationApi.delete(conversation.id)
      removeConversation(conversation.id)
      setActiveConversation(null, null)
      toast.success('Conversation deleted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete conversation')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center p-6 border-b border-border">
      {/* Action buttons row (top) */}
      <div className="self-stretch flex justify-around mb-6">
        <ActionBtn icon={Phone} label="Voice" />
        <ActionBtn icon={Video} label="Video" />
        <ActionBtn icon={Star} label={isPinned ? 'Unpin' : 'Pin'} onClick={() => { togglePinConversation(conversation.id); toast.success(isPinned ? 'Unpinned' : 'Pinned') }} active={isPinned} />
        <ActionBtn icon={BellOff} label="Mute" />
      </div>

      {/* Avatar */}
      <Avatar src={other?.avatar_url} name={other?.display_name} size="xl" status={status} />

      {/* User info */}
      <h3 className="mt-3 text-lg font-semibold text-text-primary">{other?.display_name}</h3>
      <p className="text-sm text-text-secondary">@{other?.username}</p>

      {/* Status */}
      <p className="mt-1 text-xs text-text-muted">
        {status === 'online' ? (
          <span className="text-online">Online</span>
        ) : (
          `Last seen ${formatLastSeen(lastSeen)}`
        )}
      </p>

      {/* Bio */}
      {other?.bio && (
        <p className="mt-3 text-sm text-text-secondary text-center px-2">{other.bio}</p>
      )}

      {/* Custom status */}
      {other?.custom_status && (
        <p className="mt-1 text-xs text-accent-yellow text-center px-2">"{other.custom_status}"</p>
      )}

      {/* Nicknames button */}
      <button
        onClick={() => setShowNicknamesModal(true)}
        className="mt-4 w-full px-4 py-2 bg-bg-tertiary border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors flex items-center justify-center gap-2"
      >
        <UserCog size={18} />
        <span className="text-sm font-medium">Nicknames</span>
      </button>

      {/* Actions */}
      <div className="mt-4 self-stretch space-y-1">
        <ActionRow
          icon={isBlockedByMe ? UserCheck : UserX}
          label={isBlockedByMe ? 'Unblock user' : 'Block user'}
          danger={!isBlockedByMe}
          onClick={blockLoading ? undefined : handleBlock}
        />
        <ActionRow
          icon={Trash2}
          label={deleteLoading ? 'Deleting...' : 'Delete conversation'}
          danger
          onClick={handleDeleteConversation}
          disabled={deleteLoading}
        />
        <ActionRow icon={Flag} label="Report" danger />
      </div>

      {/* Nicknames Modal */}
      {showNicknamesModal && (
        <NicknamesModal
          conversation={conversation}
          currentUser={currentUser}
          other={other}
          onClose={() => setShowNicknamesModal(false)}
        />
      )}
    </div>
  )
}

// ─── Nicknames Modal ───────────────────────────────────────────────────────────
function NicknamesModal({ conversation, currentUser, other, onClose }) {
  const { nicknames, setNickname } = useChatStore()
  const currentNickname = nicknames[conversation.id] || ''
  const [selfNickname, setSelfNickname] = useState('')
  const [editingUserId, setEditingUserId] = useState(null)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [nicknameLoading, setNicknameLoading] = useState(false)

  // Load self nickname on mount
  useEffect(() => {
    const loadSelfNickname = async () => {
      try {
        const { data } = await conversationApi.getSelfNickname(conversation.id)
        const nickname = data?.data?.self_nickname || ''
        setSelfNickname(nickname)
      } catch (_) {
        // Silently fail if not found
      }
    }
    if (conversation?.id) {
      loadSelfNickname()
    }
  }, [conversation?.id])

  const handleStartEdit = (userId, currentNick) => {
    setNicknameDraft(currentNick)
    setEditingUserId(userId)
  }

  const handleSaveNickname = async () => {
    setNicknameLoading(true)
    try {
      const newNickname = nicknameDraft.trim() || null

      if (editingUserId === currentUser?.id) {
        // Save self nickname
        await conversationApi.setSelfNickname(conversation.id, newNickname)
        setSelfNickname(newNickname)
      } else {
        // Save other user's nickname
        await conversationApi.setNickname(conversation.id, newNickname)
        setNickname(conversation.id, newNickname)
      }

      setEditingUserId(null)
      toast.success(newNickname ? 'Nickname saved' : 'Nickname cleared')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save nickname')
    } finally {
      setNicknameLoading(false)
    }
  }

  const handleClearNickname = async () => {
    setNicknameLoading(true)
    try {
      if (editingUserId === currentUser?.id) {
        // Clear self nickname
        await conversationApi.setSelfNickname(conversation.id, null)
        setSelfNickname(null)
      } else {
        // Clear other user's nickname
        await conversationApi.setNickname(conversation.id, null)
        setNickname(conversation.id, null)
      }

      setEditingUserId(null)
      toast.success('Nickname cleared')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clear nickname')
    } finally {
      setNicknameLoading(false)
    }
  }

  // Determine which user is being edited
  const editingUser = editingUserId === other?.id ? other : editingUserId === currentUser?.id ? currentUser : null
  const editingNickname = editingUserId === other?.id ? currentNickname : editingUserId === currentUser?.id ? selfNickname : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary border border-border rounded-lg shadow-lg max-w-sm w-11/12 max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Nicknames</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {editingUserId ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary mb-3">Editing nickname for {editingUser?.display_name}</p>
              <input
                type="text"
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                placeholder="Enter nickname..."
                className="w-full bg-bg-tertiary border border-border text-text-primary rounded-lg px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-yellow/50"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNickname}
                  disabled={nicknameLoading}
                  className="flex-1 px-3 py-2 bg-accent-yellow text-black text-sm rounded font-medium hover:bg-accent-yellow-dim transition-colors disabled:opacity-50"
                >
                  {nicknameLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleClearNickname}
                  disabled={nicknameLoading}
                  className="flex-1 px-3 py-2 bg-red-500/20 text-red-400 text-sm rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {nicknameLoading ? 'Clearing...' : 'Delete'}
                </button>
                <button
                  onClick={() => setEditingUserId(null)}
                  disabled={nicknameLoading}
                  className="flex-1 px-3 py-2 bg-surface-hover text-text-secondary text-sm rounded hover:bg-border transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Current User (Self) */}
              <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  <Avatar src={currentUser?.avatar_url} name={currentUser?.display_name} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-accent-yellow">
                        {selfNickname || currentUser?.display_name}
                      </p>
                      {selfNickname && (
                        <p className="text-xs text-text-muted">({currentUser?.display_name})</p>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary">@{currentUser?.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleStartEdit(currentUser?.id, selfNickname)}
                  className="p-1 hover:bg-surface-hover rounded transition-colors flex-shrink-0"
                  title="Edit nickname"
                >
                  <UserCog size={18} className="text-text-secondary hover:text-accent-yellow" />
                </button>
              </div>

              {/* Other User */}
              <div className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg">
                <div className="flex items-center gap-3 flex-1">
                  <Avatar src={other?.avatar_url} name={other?.display_name} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">
                        {currentNickname || other?.display_name}
                      </p>
                      {currentNickname && (
                        <p className="text-xs text-text-muted">({other?.display_name})</p>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary">@{other?.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleStartEdit(other?.id, currentNickname)}
                  className="p-1 hover:bg-surface-hover rounded transition-colors flex-shrink-0"
                  title="Edit nickname"
                >
                  <UserCog size={18} className="text-text-secondary hover:text-accent-yellow" />
                </button>
              </div>

              <p className="text-xs text-text-muted text-center mt-2">You can set nicknames for both users</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-bg-tertiary border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Group info ────────────────────────────────────────────────────────────────
function GroupInfo({ conversation, currentUser }) {
  const queryClient = useQueryClient()
  const { removeGroup, upsertGroup } = useChatStore()

  const [leaving, setLeaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingGroup, setSavingGroup] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showNicknamesModal, setShowNicknamesModal] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [muteDurations, setMuteDurations] = useState({})
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    type: 'private',
  })

  const { data: groupData } = useQuery({
    queryKey: ['group-detail', conversation.id],
    queryFn: () => groupApi.get(conversation.id).then((r) => r.data.data),
    enabled: !!conversation?.id,
  })

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['group-members', conversation.id],
    queryFn: () => groupApi.getMembers(conversation.id).then((r) => r.data.data),
  })

  const { data: searchUsersData, isFetching: searchingUsers } = useQuery({
    queryKey: ['group-add-member-search', conversation.id, memberSearch],
    queryFn: () =>
      userApi.search(memberSearch).then((r) => r.data.data?.users || r.data.data || []),
    enabled: showAddMember && memberSearch.trim().length >= 2,
  })

  const group = groupData || conversation
  const members = membersData || []
  const myRole = members.find((m) => m.user?.id === currentUser?.id)?.role || group?.my_role || 'member'

  const memberIds = useMemo(
    () => new Set(members.map((m) => m.user?.id).filter(Boolean)),
    [members]
  )

  const addableUsers = (searchUsersData || []).filter((u) => !memberIds.has(u.id))

  const canManageGroup = ['owner', 'admin'].includes(myRole)
  const canAddMembers = ['owner', 'admin'].includes(myRole)
  const canDeleteGroup = myRole === 'owner'

  useEffect(() => {
    setGroupForm({
      name: group?.name || '',
      description: group?.description || '',
      type: group?.type || 'private',
    })
  }, [group?.id, group?.name, group?.description, group?.type])

  const canManageMember = (member) => {
    const targetRole = member?.role || 'member'
    const targetUserId = member?.user?.id

    if (!targetUserId || targetUserId === currentUser?.id) return false
    if (myRole === 'owner') return targetRole !== 'owner'
    if (myRole === 'admin') return ['member', 'moderator'].includes(targetRole)

    return false
  }

  const canMuteMember = (member) => {
    const targetRole = member?.role || 'member'
    const targetUserId = member?.user?.id

    if (!targetUserId || targetUserId === currentUser?.id) return false
    if (!['owner', 'admin', 'moderator'].includes(myRole)) return false

    return !['owner', 'admin'].includes(targetRole)
  }

  const roleOptionsFor = (member) => {
    if (!canManageMember(member)) return []
    if (myRole === 'owner') return ['admin', 'moderator', 'member']
    if (myRole === 'admin') return ['moderator', 'member']
    return []
  }

  const refreshGroupState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['groups'] }),
      queryClient.invalidateQueries({ queryKey: ['group-members', conversation.id] }),
      queryClient.invalidateQueries({ queryKey: ['group-detail', conversation.id] }),
    ])

    try {
      const { data } = await groupApi.get(conversation.id)
      const nextGroup = data?.data
      if (nextGroup?.id) upsertGroup(nextGroup)
    } catch (_) { }
  }

  const handleSaveGroup = async () => {
    if (!canManageGroup || savingGroup) return
    if (!groupForm.name.trim()) {
      toast.error('Group name is required')
      return
    }

    setSavingGroup(true)
    try {
      await groupApi.update(conversation.id, {
        name: groupForm.name.trim(),
        description: groupForm.description.trim(),
        type: groupForm.type,
      })
      await refreshGroupState()
      toast.success('Group updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update group')
    } finally {
      setSavingGroup(false)
    }
  }

  const handleUploadAvatar = async (file) => {
    if (!file || !canManageGroup) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setUploadingAvatar(true)
    try {
      await groupApi.uploadAvatar(conversation.id, file)
      await refreshGroupState()
      toast.success('Group picture updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload group picture')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleCopyInviteLink = async () => {
    const inviteCode = group?.invite_link
    if (!inviteCode) {
      toast.error('Invite link is not available')
      return
    }

    const inviteUrl = `${window.location.origin}/join/${inviteCode}`

    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast.success('Invite link copied')
    } catch (_) {
      toast.error('Could not copy invite link')
    }
  }

  const handleAddMember = async (user) => {
    if (!canAddMembers || !user?.id) return
    const actionKey = `add:${user.id}`
    setBusyAction(actionKey)

    try {
      await groupApi.addMember(conversation.id, user.id)
      await refreshGroupState()
      setMemberSearch('')
      toast.success(`${user.display_name} added`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member')
    } finally {
      setBusyAction('')
    }
  }

  const handleRemoveMember = async (member) => {
    const targetId = member?.user?.id
    const targetName = member?.user?.display_name || 'this member'
    if (!targetId || !canManageMember(member)) return

    const confirmed = window.confirm(`Remove ${targetName} from this group?`)
    if (!confirmed) return

    const actionKey = `remove:${targetId}`
    setBusyAction(actionKey)
    try {
      await groupApi.removeMember(conversation.id, targetId)
      await refreshGroupState()
      toast.success(`${targetName} removed`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member')
    } finally {
      setBusyAction('')
    }
  }

  const handleRoleChange = async (member, nextRole) => {
    const targetId = member?.user?.id
    const currentRole = member?.role

    if (!targetId || !canManageMember(member)) return
    if (!nextRole || nextRole === currentRole) return

    const actionKey = `role:${targetId}`
    setBusyAction(actionKey)
    try {
      await groupApi.updateRole(conversation.id, targetId, nextRole)
      await refreshGroupState()
      toast.success('Role updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role')
    } finally {
      setBusyAction('')
    }
  }

  const handleMuteMember = async (member) => {
    const targetId = member?.user?.id
    const targetName = member?.user?.display_name || 'Member'
    if (!targetId || !canMuteMember(member)) return

    const duration = Number(muteDurations[targetId] || 60)
    const actionKey = `mute:${targetId}`
    setBusyAction(actionKey)

    try {
      await groupApi.muteMember(conversation.id, targetId, duration)
      await refreshGroupState()
      toast.success(`${targetName} muted for ${duration} minutes`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mute member')
    } finally {
      setBusyAction('')
    }
  }

  const handleLeaveGroup = async () => {
    if (leaving) return
    setLeaving(true)
    try {
      await groupApi.leave(conversation.id)
      removeGroup(conversation.id)
      toast.success('You left the group')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave group')
    } finally {
      setLeaving(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!canDeleteGroup || deleting) return

    const confirmed = window.confirm('Delete this group permanently? This cannot be undone.')
    if (!confirmed) return

    setDeleting(true)
    try {
      await groupApi.delete(conversation.id)
      removeGroup(conversation.id)
      toast.success('Group deleted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete group')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Group header */}
      <div className="flex flex-col items-center p-6 border-b border-border">
        {/* Action buttons */}
        <div className="self-stretch flex justify-around mb-6">
          <ActionBtn icon={Phone} label="Call" />
          <ActionBtn icon={Video} label="Video" />
          {canAddMembers ? (
            <ActionBtn
              icon={showAddMember ? X : UserPlus}
              label={showAddMember ? 'Close add' : 'Add'}
              onClick={() => setShowAddMember((prev) => !prev)}
            />
          ) : (
            <ActionBtn icon={Users} label="Members" />
          )}
          <ActionBtn icon={Copy} label="Invite" onClick={handleCopyInviteLink} />
        </div>

        <Avatar src={group.avatar_url} name={group.name} size="2xl" />
        <h3 className="mt-3 text-lg font-semibold text-text-primary">{group.name}</h3>
        {group.unique_group_id && (
          <p className="mt-1 text-xs text-accent-yellow">@{group.unique_group_id}</p>
        )}
        <p className="text-sm text-text-secondary">
          {group.type === 'public' ? 'Public' : group.type === 'private' ? 'Private' : 'Secret'} group
          {' · '}{members.length} members
        </p>
        {group.description && (
          <p className="mt-2 text-sm text-text-secondary text-center px-2">{group.description}</p>
        )}

        {/* Nicknames button */}
        <button
          onClick={() => setShowNicknamesModal(true)}
          className="mt-4 w-full px-4 py-2 bg-bg-tertiary border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors flex items-center justify-center gap-2"
        >
          <UserCog size={18} />
          <span className="text-sm font-medium">Nicknames</span>
        </button>
      </div>

      {canManageGroup && (
        <div className="px-3 pt-3">
          <div className="bg-bg-elevated border border-border rounded-xl p-3 space-y-3">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Group settings</h4>

            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-2">
              <label className="flex items-center justify-center w-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUploadAvatar(file)
                    // Reset input
                    e.target.value = ''
                  }}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.parentElement?.querySelector('input')?.click()
                  }}
                  disabled={uploadingAvatar}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  {uploadingAvatar ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Image className="w-4 h-4" />
                  )}
                  {uploadingAvatar ? 'Uploading...' : 'Change group picture'}
                </button>
              </label>
            </div>

            <input
              type="text"
              className="input-field"
              placeholder="Group name"
              value={groupForm.name}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
            />

            <textarea
              rows={2}
              className="input-field resize-none"
              placeholder="Description"
              value={groupForm.description}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
            />

            <input
              type="text"
              className="input-field text-text-muted"
              value={group?.unique_group_id ? `@${group.unique_group_id}` : 'No group ID'}
              readOnly
            />

            <select
              className="input-field"
              value={groupForm.type}
              disabled={myRole !== 'owner'}
              onChange={(e) => setGroupForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="secret">Secret</option>
            </select>

            {myRole !== 'owner' && (
              <p className="text-xs text-text-muted">Only the owner can change group visibility.</p>
            )}

            <button
              onClick={handleSaveGroup}
              disabled={savingGroup}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {savingGroup ? (
                <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {savingGroup ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {showAddMember && canAddMembers && (
        <div className="px-3 pt-3">
          <div className="bg-bg-elevated border border-border rounded-xl p-3 space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Add members</h4>
            <input
              type="text"
              className="input-field"
              placeholder="Search users"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />

            <div className="max-h-44 overflow-y-auto space-y-1">
              {memberSearch.trim().length < 2 && (
                <p className="text-xs text-text-muted text-center py-2">Type at least 2 characters to search</p>
              )}

              {searchingUsers && (
                <p className="text-xs text-text-muted text-center py-2">Searching...</p>
              )}

              {!searchingUsers && memberSearch.trim().length >= 2 && addableUsers.length === 0 && (
                <p className="text-xs text-text-muted text-center py-2">No addable users found</p>
              )}

              {addableUsers.map((u) => {
                const actionKey = `add:${u.id}`
                const adding = busyAction === actionKey

                return (
                  <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover transition-colors">
                    <Avatar src={u.avatar_url} name={u.display_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{u.display_name}</p>
                      <p className="text-xs text-text-muted truncate">@{u.username}</p>
                    </div>
                    <button
                      onClick={() => handleAddMember(u)}
                      disabled={adding}
                      className="px-2.5 py-1 rounded-lg bg-accent-yellow text-black text-xs font-semibold hover:bg-accent-yellow-dim transition-colors disabled:opacity-60"
                    >
                      {adding ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="px-3 py-3">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">Members</h4>
        {membersLoading ? (
          <p className="text-xs text-text-muted text-center py-4">Loading members...</p>
        ) : (
          <div className="space-y-1">
            {members.map((member) => {
              const targetId = member?.user?.id
              return (
                <MemberRow
                  key={member.id || targetId}
                  member={member}
                  currentUser={currentUser}
                  canManage={canManageMember(member)}
                  canMute={canMuteMember(member)}
                  roleOptions={roleOptionsFor(member)}
                  busyAction={busyAction}
                  muteDuration={Number(muteDurations[targetId] || 60)}
                  onMuteDurationChange={(duration) =>
                    setMuteDurations((prev) => ({ ...prev, [targetId]: duration }))
                  }
                  onRemove={handleRemoveMember}
                  onRoleChange={handleRoleChange}
                  onMute={handleMuteMember}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Group actions */}
      <div className="px-3 pb-3">
        <ActionRow
          icon={UserMinus}
          label={leaving ? 'Leaving...' : 'Leave group'}
          danger
          onClick={handleLeaveGroup}
          disabled={leaving || deleting}
        />
        {canDeleteGroup && (
          <ActionRow
            icon={Trash2}
            label={deleting ? 'Deleting...' : 'Delete group'}
            danger
            onClick={handleDeleteGroup}
            disabled={deleting || leaving}
          />
        )}
      </div>

      {/* Group Nicknames Modal */}
      {showNicknamesModal && (
        <GroupNicknamesModal
          group={conversation}
          currentUser={currentUser}
          onClose={() => setShowNicknamesModal(false)}
        />
      )}
    </div>
  )
}

// ─── Group Nicknames Modal ─────────────────────────────────────────────────────
function GroupNicknamesModal({ group, currentUser, onClose }) {
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [editingMemberId, setEditingMemberId] = useState(null)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [nicknameLoading, setNicknameLoading] = useState(false)
  const { getGroupMemberNickname } = useChatStore()

  // Load group members and their nicknames on mount
  useEffect(() => {
    const loadGroupMembers = async () => {
      try {
        const { data } = await groupApi.getMembers(group.id)
        const membersData = data?.data || []

        // Load nicknames for each member from store or API
        const membersWithNicknames = membersData.map((member) => {
          const storeNickname = getGroupMemberNickname(group.id, member.user_id)
          return { ...member, nickname: storeNickname || '' }
        })

        setMembers(membersWithNicknames)
      } catch (err) {
        console.error('Failed to load group members:', err)
      } finally {
        setMembersLoading(false)
      }
    }

    if (group?.id) {
      loadGroupMembers()
    }
  }, [group?.id, getGroupMemberNickname])

  const handleStartEdit = (member) => {
    setEditingMemberId(member.user_id)
    setNicknameDraft(member.nickname || '')
  }

  const handleSaveNickname = async (memberId) => {
    setNicknameLoading(true)
    try {
      const newNickname = nicknameDraft.trim() || null
      await groupApi.setMemberNickname(group.id, newNickname, memberId)

      setMembers(members.map(m =>
        m.user_id === memberId ? { ...m, nickname: newNickname } : m
      ))
      setEditingMemberId(null)
      toast.success(newNickname ? 'Nickname saved' : 'Nickname cleared')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save nickname')
    } finally {
      setNicknameLoading(false)
    }
  }

  const handleClearNickname = async (memberId) => {
    setNicknameLoading(true)
    try {
      await groupApi.setMemberNickname(group.id, null, memberId)

      setMembers(members.map(m =>
        m.user_id === memberId ? { ...m, nickname: '' } : m
      ))
      setEditingMemberId(null)
      toast.success('Nickname cleared')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clear nickname')
    } finally {
      setNicknameLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary border border-border rounded-lg shadow-lg max-w-sm w-11/12 max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Nicknames</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent-yellow/30 border-t-accent-yellow rounded-full animate-spin" />
            </div>
          ) : editingMemberId ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary mb-3">Set nickname for this member</p>
              <input
                type="text"
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                placeholder="Enter nickname..."
                className="w-full bg-bg-tertiary border border-border text-text-primary rounded-lg px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-yellow/50"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveNickname(editingMemberId)}
                  disabled={nicknameLoading}
                  className="flex-1 px-3 py-2 bg-accent-yellow text-black text-sm rounded font-medium hover:bg-accent-yellow-dim transition-colors disabled:opacity-50"
                >
                  {nicknameLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => handleClearNickname(editingMemberId)}
                  disabled={nicknameLoading}
                  className="flex-1 px-3 py-2 bg-red-500/20 text-red-400 text-sm rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {nicknameLoading ? 'Clearing...' : 'Delete'}
                </button>
                <button
                  onClick={() => setEditingMemberId(null)}
                  disabled={nicknameLoading}
                  className="flex-1 px-3 py-2 bg-surface-hover text-text-secondary text-sm rounded hover:bg-border transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map(member => (
                <div key={member.user_id} className="flex items-center justify-between p-3 bg-bg-tertiary rounded-lg hover:bg-surface-hover transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar src={member.user?.avatar_url} name={member.user?.display_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-accent-yellow truncate">
                          {member.nickname || member.user?.display_name}
                        </p>
                        {member.nickname && (
                          <p className="text-xs text-text-muted truncate">({member.user?.display_name})</p>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary truncate">@{member.user?.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartEdit(member)}
                    className="p-1 hover:bg-surface-hover rounded transition-colors flex-shrink-0 ml-2"
                    title="Edit nickname"
                  >
                    <UserCog size={18} className="text-text-secondary hover:text-accent-yellow" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-bg-tertiary border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Media section ─────────────────────────────────────────────────────────────
function MediaSection({ conversationId, activeType }) {
  const [activeTab, setActiveTab] = useState('photos')
  const [expanded, setExpanded] = useState(true)

  const { data } = useQuery({
    queryKey: ['conversation-media', conversationId],
    queryFn: () => {
      const api = activeType === 'group' ? groupApi : conversationApi
      return api.getMedia
        ? api.getMedia(conversationId).then((r) => r.data.data)
        : Promise.resolve([])
    },
    enabled: !!conversationId,
  })

  const photos = (data || []).filter((m) => m.message_type === 'image')
  const files = (data || []).filter((m) => m.message_type === 'file')
  const links = (data || []).filter((m) => m.message_type === 'text' && m.content?.text?.includes('http'))

  return (
    <div className="flex-1 flex flex-col mt-2">
      {/* Collapsible: Photos */}
      <SectionHeader
        icon={Image}
        label="Photos"
        count={photos.length}
        expanded={activeTab === 'photos' && expanded}
        onToggle={() => { setActiveTab('photos'); setExpanded(activeTab !== 'photos' || !expanded) }}
      />
      {activeTab === 'photos' && expanded && (
        <div className="grid grid-cols-3 gap-1 px-2 pb-2">
          {photos.slice(0, 9).map((m) => (
            <img
              key={m._id || m.id}
              src={m.content?.media_url}
              className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              alt=""
            />
          ))}
          {photos.length === 0 && (
            <p className="col-span-3 text-xs text-text-muted text-center py-4">No photos</p>
          )}
        </div>
      )}

      {/* Files */}
      <SectionHeader
        icon={File}
        label="Files"
        count={files.length}
        expanded={activeTab === 'files' && expanded}
        onToggle={() => { setActiveTab('files'); setExpanded(activeTab !== 'files' || !expanded) }}
      />
      {activeTab === 'files' && expanded && (
        <div className="px-3 pb-2 space-y-1">
          {files.slice(0, 5).map((m) => (
            <a
              key={m._id || m.id}
              href={m.content?.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <File className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{m.content?.file_name || 'File'}</span>
            </a>
          ))}
          {files.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">No files</p>
          )}
        </div>
      )}

      {/* Links */}
      <SectionHeader
        icon={Link2}
        label="Links"
        count={links.length}
        expanded={activeTab === 'links' && expanded}
        onToggle={() => { setActiveTab('links'); setExpanded(activeTab !== 'links' || !expanded) }}
      />
      {activeTab === 'links' && expanded && (
        <div className="px-3 pb-2 space-y-1">
          {links.length === 0 && (
            <p className="text-xs text-text-muted text-center py-4">No links shared</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
function ActionBtn({ icon: Icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group"
    >
      <div className={clsx(
        'w-11 h-11 border rounded-2xl flex items-center justify-center transition-colors',
        active
          ? 'bg-accent-yellow/10 border-accent-yellow/40 text-accent-yellow'
          : 'bg-bg-elevated border-border text-text-secondary group-hover:text-accent-yellow group-hover:border-accent-yellow/40'
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[11px] text-text-muted">{label}</span>
    </button>
  )
}

function ActionRow({ icon: Icon, label, danger, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors',
        danger
          ? 'text-busy hover:bg-busy/10'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        disabled && 'opacity-60 cursor-not-allowed hover:bg-transparent'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </button>
  )
}

function SectionHeader({ icon: Icon, label, count, expanded, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-hover transition-colors border-t border-border"
    >
      <Icon className="w-4 h-4 text-text-muted" />
      <span className="text-sm font-medium text-text-secondary flex-1 text-left">{label}</span>
      {count > 0 && <span className="text-xs text-text-muted">{count}</span>}
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-text-muted" />
      ) : (
        <ChevronRight className="w-4 h-4 text-text-muted" />
      )}
    </button>
  )
}

const ROLE_ICONS = {
  owner: Crown,
  admin: UserCog,
  moderator: Shield,
  member: null,
}

function MemberRow({
  member,
  currentUser,
  canManage,
  canMute,
  roleOptions,
  busyAction,
  muteDuration,
  onMuteDurationChange,
  onRemove,
  onRoleChange,
  onMute,
}) {
  const u = member.user || member
  const role = member.role || 'member'
  const RoleIcon = ROLE_ICONS[role]
  const isMe = u.id === currentUser?.id

  const roleBusy = busyAction === `role:${u.id}`
  const removeBusy = busyAction === `remove:${u.id}`
  const muteBusy = busyAction === `mute:${u.id}`

  return (
    <div className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors">
      <Avatar src={u.avatar_url} name={u.display_name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {u.display_name}
          {isMe && <span className="text-text-muted text-xs ml-1">(You)</span>}
        </p>

        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {role !== 'member' && (
            <span className="text-xs text-text-muted capitalize">{role}</span>
          )}

          {roleOptions.length > 0 && (
            <select
              value={role}
              onChange={(e) => onRoleChange(member, e.target.value)}
              disabled={roleBusy || removeBusy || muteBusy}
              className="text-xs bg-bg-tertiary border border-border rounded-md px-2 py-1 text-text-secondary"
            >
              {roleOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          {canMute && (
            <div className="flex items-center gap-1">
              <select
                value={muteDuration}
                onChange={(e) => onMuteDurationChange(Number(e.target.value))}
                disabled={muteBusy || removeBusy || roleBusy}
                className="text-xs bg-bg-tertiary border border-border rounded-md px-1.5 py-1 text-text-secondary"
              >
                <option value={10}>10m</option>
                <option value={60}>1h</option>
                <option value={240}>4h</option>
                <option value={1440}>24h</option>
              </select>
              <button
                onClick={() => onMute(member)}
                disabled={muteBusy || removeBusy || roleBusy}
                className="text-xs px-2 py-1 rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-60"
              >
                {muteBusy ? 'Muting...' : 'Mute'}
              </button>
            </div>
          )}

          {canManage && (
            <button
              onClick={() => onRemove(member)}
              disabled={removeBusy || roleBusy || muteBusy}
              className="text-xs px-2 py-1 rounded-md border border-busy/40 text-busy hover:bg-busy/10 disabled:opacity-60"
            >
              {removeBusy ? 'Removing...' : 'Remove'}
            </button>
          )}
        </div>
      </div>
      {RoleIcon && (
        <RoleIcon className={clsx('w-3.5 h-3.5', role === 'owner' ? 'text-accent-yellow' : 'text-text-muted')} />
      )}
    </div>
  )
}
