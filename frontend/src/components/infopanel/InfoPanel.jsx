import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Phone, Video, Star, Users, Image, File, Link2,
  ChevronDown, ChevronRight, Shield, Bell, BellOff,
  UserMinus, UserX, Flag, Crown, UserCog
} from 'lucide-react'
import clsx from 'clsx'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import Avatar from '@/components/ui/Avatar'
import { groupApi, conversationApi } from '@/lib/apiServices'
import { formatLastSeen } from '@/utils/helpers'

const SECTIONS = [
  { id: 'media', label: 'Photos', icon: Image },
  { id: 'files', label: 'Files', icon: File },
  { id: 'links', label: 'Links', icon: Link2 },
]

export default function InfoPanel() {
  const { activeConversation, activeType, presenceMap } = useChatStore()
  const { user } = useAuthStore()
  const [expandedSection, setExpandedSection] = useState('media')

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
  const other =
    conversation.participant_1?.id === currentUser?.id
      ? conversation.participant_2
      : conversation.participant_1

  const presence = other ? presenceMap[other?.id] : null
  const status = presence?.status || other?.online_status || 'offline'
  const lastSeen = presence?.last_seen || other?.last_seen

  return (
    <div className="flex flex-col items-center p-6 border-b border-border">
      {/* Action buttons row (top) */}
      <div className="self-stretch flex justify-around mb-6">
        <ActionBtn icon={Phone} label="Voice" />
        <ActionBtn icon={Video} label="Video" />
        <ActionBtn icon={Star} label="Pin" />
        <ActionBtn icon={BellOff} label="Mute" />
      </div>

      {/* Avatar */}
      <Avatar src={other?.avatar_url} name={other?.display_name} size="2xl" status={status} />
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

      {/* Actions */}
      <div className="mt-4 self-stretch space-y-1">
        <ActionRow icon={UserX} label="Block user" danger />
        <ActionRow icon={Flag} label="Report" danger />
      </div>
    </div>
  )
}

// ─── Group info ────────────────────────────────────────────────────────────────
function GroupInfo({ conversation, currentUser }) {
  const { data: membersData } = useQuery({
    queryKey: ['group-members', conversation.id],
    queryFn: () => groupApi.getMembers(conversation.id).then((r) => r.data.data),
  })

  const members = membersData || []
  const myRole = members.find((m) => m.user?.id === currentUser?.id)?.role

  return (
    <div className="flex flex-col">
      {/* Group header */}
      <div className="flex flex-col items-center p-6 border-b border-border">
        {/* Action buttons */}
        <div className="self-stretch flex justify-around mb-6">
          <ActionBtn icon={Phone} label="Call" />
          <ActionBtn icon={Video} label="Video" />
          <ActionBtn icon={Users} label="Invite" />
          <ActionBtn icon={BellOff} label="Mute" />
        </div>

        <Avatar src={conversation.avatar_url} name={conversation.name} size="2xl" />
        <h3 className="mt-3 text-lg font-semibold text-text-primary">{conversation.name}</h3>
        <p className="text-sm text-text-secondary">
          {conversation.type === 'public' ? 'Public' : conversation.type === 'private' ? 'Private' : 'Secret'} group
          {' · '}{members.length} members
        </p>
        {conversation.description && (
          <p className="mt-2 text-sm text-text-secondary text-center px-2">{conversation.description}</p>
        )}
      </div>

      {/* Members list */}
      <div className="px-3 py-3">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">Members</h4>
        <div className="space-y-0.5">
          {members.slice(0, 10).map((member) => (
            <MemberRow key={member.id || member.user?.id} member={member} currentUser={currentUser} myRole={myRole} />
          ))}
          {members.length > 10 && (
            <button className="w-full text-sm text-accent-yellow py-2 hover:text-accent-yellow-dim transition-colors">
              View all {members.length} members
            </button>
          )}
        </div>
      </div>

      {/* Leave group */}
      <div className="px-3 pb-3">
        <ActionRow icon={UserMinus} label="Leave group" danger />
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
function ActionBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group"
    >
      <div className="w-11 h-11 bg-bg-elevated border border-border rounded-2xl flex items-center justify-center text-text-secondary group-hover:text-accent-yellow group-hover:border-accent-yellow/40 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[11px] text-text-muted">{label}</span>
    </button>
  )
}

function ActionRow({ icon: Icon, label, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors',
        danger
          ? 'text-busy hover:bg-busy/10'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
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

function MemberRow({ member, currentUser, myRole }) {
  const u = member.user || member
  const role = member.role || 'member'
  const RoleIcon = ROLE_ICONS[role]
  const isMe = u.id === currentUser?.id

  return (
    <div className="flex items-center gap-2.5 px-1 py-2 rounded-lg hover:bg-surface-hover transition-colors">
      <Avatar src={u.avatar_url} name={u.display_name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {u.display_name}
          {isMe && <span className="text-text-muted text-xs ml-1">(You)</span>}
        </p>
        {role !== 'member' && (
          <p className="text-xs text-text-muted capitalize">{role}</p>
        )}
      </div>
      {RoleIcon && (
        <RoleIcon className={clsx('w-3.5 h-3.5', role === 'owner' ? 'text-accent-yellow' : 'text-text-muted')} />
      )}
    </div>
  )
}
