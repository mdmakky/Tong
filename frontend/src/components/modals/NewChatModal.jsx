import { useEffect, useRef, useState } from 'react'
import { X, Users, Lock, Globe, Shield, Camera, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { userApi, conversationApi, groupApi } from '@/lib/apiServices'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import Avatar from '@/components/ui/Avatar'

const TABS = ['New Chat', 'New Group']

export default function NewChatModal({ onClose }) {
  const [tab, setTab] = useState(0)
  const [query, setQuery] = useState('')
  const { setActiveConversation, upsertConversation, upsertGroup } = useChatStore()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-md shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Start Conversation</h2>
          <button onClick={onClose} className="icon-btn">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === i
                  ? 'text-accent-yellow border-b-2 border-accent-yellow'
                  : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 0 ? (
            <NewDirectChat
              query={query}
              setQuery={setQuery}
              onSuccess={(conv) => {
                upsertConversation(conv)
                setActiveConversation(conv, conv.type)
                onClose()
              }}
            />
          ) : (
            <NewGroupChat
              onSuccess={(group) => {
                upsertGroup(group)
                setActiveConversation(group, 'group')
                onClose()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function NewDirectChat({ query, setQuery, onSuccess }) {
  const [starting, setStarting] = useState(null)
  const { user } = useAuthStore()

  const { data, isFetching } = useQuery({
    queryKey: ['search-new-chat', query],
    queryFn: () => userApi.search(query).then((r) => r.data.data.users ?? r.data.data ?? []),
    enabled: query.length >= 2,
  })

  const start = async (targetUserId) => {
    setStarting(targetUserId)
    try {
      const { data: res } = await conversationApi.create(targetUserId)
      const conv = res.data
      // Normalize: ensure other_user is always present regardless of response shape
      const other = conv.other_user || (conv.participant_1 === user?.id ? conv.user2 : conv.user1)
      onSuccess({ ...conv, other_user: other })
    } catch (_) {
      toast.error('Could not start conversation')
    } finally {
      setStarting(null)
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        className="input-field"
        placeholder="Search by name or @username..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {query.length < 2 && (
          <p className="text-text-muted text-sm text-center py-6">Type to search users</p>
        )}
        {isFetching && (
          <p className="text-text-muted text-sm text-center py-4">Searching...</p>
        )}
        {!isFetching && query.length >= 2 && data?.length === 0 && (
          <p className="text-text-muted text-sm text-center py-4">No users found</p>
        )}
        {data?.map((u) => (
          <button
            key={u.id}
            onClick={() => start(u.id)}
            disabled={starting === u.id}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-hover transition-colors"
          >
            <Avatar src={u.avatar_url} name={u.display_name} size="md" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-text-primary">{u.display_name}</p>
              <p className="text-xs text-text-muted">@{u.username}</p>
            </div>
            {starting === u.id && (
              <div className="w-4 h-4 border-2 border-border border-t-accent-yellow rounded-full animate-spin" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function NewGroupChat({ onSuccess }) {
  const UNIQUE_GROUP_ID_REGEX = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?$/

  const [name, setName] = useState('')
  const [uniqueGroupId, setUniqueGroupId] = useState('')
  const [debouncedGroupId, setDebouncedGroupId] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('private')
  const [creating, setCreating] = useState(false)
  const avatarInputRef = useRef(null)
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const normalizedGroupId = uniqueGroupId.trim().toLowerCase()
  const isGroupIdFormatValid = UNIQUE_GROUP_ID_REGEX.test(normalizedGroupId)

  const normalizeGroupIdInput = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 30)

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedGroupId(normalizedGroupId)
    }, 300)

    return () => clearTimeout(handle)
  }, [normalizedGroupId])

  const {
    data: groupIdAvailability,
    isFetching: isCheckingGroupId,
    isError: isGroupIdCheckError,
    error: groupIdCheckError,
  } = useQuery({
    queryKey: ['check-group-id', debouncedGroupId],
    queryFn: () => groupApi.checkUniqueId(debouncedGroupId).then((r) => r.data.data),
    enabled: debouncedGroupId.length >= 3 && isGroupIdFormatValid,
    staleTime: 5000,
    retry: 1,
  })

  const isAvailabilitySettled =
    debouncedGroupId === normalizedGroupId &&
    normalizedGroupId.length >= 3 &&
    isGroupIdFormatValid &&
    !isCheckingGroupId

  const isGroupIdAvailable =
    isAvailabilitySettled &&
    !isGroupIdCheckError &&
    Boolean(groupIdAvailability?.available)
  const isGroupIdTaken =
    isAvailabilitySettled &&
    !isGroupIdCheckError &&
    groupIdAvailability?.available === false

  const handleAvatarChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setAvatar(f)
    setAvatarPreview(URL.createObjectURL(f))
  }

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Group name required')
    if (!normalizedGroupId) return toast.error('Unique Group ID required')
    if (!isGroupIdFormatValid) {
      return toast.error('Unique Group ID must be 3-30 chars using lowercase letters, numbers, _ or -')
    }
    if (!isGroupIdAvailable) return toast.error('Unique Group ID is not available yet')

    setCreating(true)
    try {
      const { data: res } = await groupApi.create({
        name: name.trim(),
        unique_group_id: normalizedGroupId,
        description,
        type,
      })
      const group = res.data
      // Upload avatar if selected
      if (avatar) {
        try {
          const { data: avatarRes } = await groupApi.uploadAvatar(group.id, avatar)
          group.avatar_url = avatarRes.data?.avatar_url
        } catch (_) { }
      }
      toast.success(`Group "${name}" created!`)
      onSuccess(group)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group')
    } finally {
      setCreating(false)
    }
  }

  const TYPE_OPTS = [
    { value: 'public', icon: Globe, label: 'Public', desc: 'Anyone can join' },
    { value: 'private', icon: Lock, label: 'Private', desc: 'Invite only' },
    { value: 'secret', icon: Shield, label: 'Secret', desc: 'Encrypted' },
  ]

  return (
    <form onSubmit={create} className="space-y-4">
      {/* Avatar */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="relative"
        >
          {avatarPreview ? (
            <img src={avatarPreview} className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 bg-bg-elevated border border-dashed border-border rounded-2xl flex items-center justify-center text-text-muted hover:border-accent-yellow/50 transition-colors">
              <Camera className="w-6 h-6" />
            </div>
          )}
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Group Name</label>
        <input
          type="text"
          className="input-field"
          placeholder="My Awesome Group"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Unique Group ID</label>
        <input
          type="text"
          className="input-field"
          placeholder="my-group-123"
          value={uniqueGroupId}
          onChange={(e) => setUniqueGroupId(normalizeGroupIdInput(e.target.value))}
        />
        <p className="text-[11px] text-text-muted mt-1">
          Used to identify your group uniquely. Lowercase letters, numbers, _ and - only.
        </p>

        {uniqueGroupId.length > 0 && uniqueGroupId.length < 3 && (
          <p className="text-[11px] text-red-400 mt-1">Must be at least 3 characters</p>
        )}

        {uniqueGroupId.length >= 3 && !isGroupIdFormatValid && (
          <p className="text-[11px] text-red-400 mt-1">Invalid format</p>
        )}

        {isCheckingGroupId && (
          <p className="text-[11px] text-text-muted mt-1">Checking availability...</p>
        )}

        {isAvailabilitySettled && isGroupIdAvailable && (
          <p className="text-[11px] text-green-400 mt-1">Available</p>
        )}

        {isGroupIdTaken && (
          <p className="text-[11px] text-red-400 mt-1">This ID is already taken</p>
        )}

        {isGroupIdCheckError && !isCheckingGroupId && uniqueGroupId.length >= 3 && (
          <p className="text-[11px] text-red-400 mt-1">
            {groupIdCheckError?.response?.data?.message || 'Could not check availability'}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Description <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          className="input-field resize-none"
          rows={2}
          placeholder="What's this group about?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Type selection */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs transition-colors ${type === t.value
                  ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                  : 'border-border text-text-secondary hover:border-border/80'
                }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="font-medium">{t.label}</span>
              <span className="text-[10px] opacity-70">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={creating || !name.trim() || !isGroupIdAvailable || isCheckingGroupId}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {creating ? (
          <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
        ) : (
          <Users className="w-4 h-4" />
        )}
        Create Group
      </button>
    </form>
  )
}
