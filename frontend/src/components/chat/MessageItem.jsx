import { useState, useRef } from 'react'
import clsx from 'clsx'
import {
  Check, CheckCheck, Clock, MoreHorizontal, Reply, Forward,
  Pencil, Trash2, Pin, Smile, AlertCircle, FileText, Play,
  Mic, Image as ImageIcon, MapPin
} from 'lucide-react'
import toast from 'react-hot-toast'
import Avatar from '@/components/ui/Avatar'
import { formatMessageTime, getReactionSummary, hasReacted } from '@/utils/helpers'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import { messageApi } from '@/lib/apiServices'
import { getSocket } from '@/lib/socket'
import ReactionPicker from './ReactionPicker'
import ReplyPreview from './ReplyPreview'
import MediaLightbox from '@/components/ui/MediaLightbox'

export default function MessageItem({ message, isOwn, conversationId, previousMessage, isLastReadMessage }) {
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [showStatusPopup, setShowStatusPopup] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState(message.content?.text || '')
  const { setReplyTo, updateMessage, deleteMessage } = useChatStore()
  const { user } = useAuthStore()
  const socket = getSocket()

  const msg = message
  const isDeleted = msg.is_deleted_for_all

  // Check if message is older than 24 hours
  const isOlderThan24Hours = () => {
    const messageTime = new Date(msg.created_at).getTime()
    const currentTime = Date.now()
    const hoursDiff = (currentTime - messageTime) / (1000 * 60 * 60)
    return hoursDiff > 24
  }

  // Check if this is a system event message (e.g. "X added Y")
  const isSystem = msg.message_type === 'system'

  if (isSystem) {
    return (
      <div className="flex items-center justify-center py-2 px-6">
        <span className="text-xs text-text-muted bg-bg-elevated px-3 py-1 rounded-full">
          {msg.content?.text}
        </span>
      </div>
    )
  }

  const showAvatar = !isOwn && (
    !previousMessage ||
    previousMessage.type === 'separator' ||
    previousMessage.data?.sender_id !== msg.sender_id
  )

  const sender = msg.sender || (isOwn ? null : msg)

  // Status icon
  const StatusIcon = () => {
    if (!isOwn) return null
    const status = msg.status
    if (status === 'pending') return <Clock className="w-3 h-3 text-text-muted" />
    if (status === 'delivered') return <CheckCheck className="w-3 h-3 text-text-muted" />
    if (status === 'read') return <CheckCheck className="w-3 h-3 text-accent-yellow" />
    // Default: single tick ('sent' or any unknown status)
    return <Check className="w-3 h-3 text-text-muted" />
  }

  // Format status label for the popup
  const getStatusLabel = () => {
    const status = msg.status
    if (status === 'pending') return 'Sending...'
    if (status === 'delivered') return 'Delivered'
    if (status === 'read') {
      const readAt = msg.read_by?.read_at
      if (readAt) {
        const diff = Date.now() - new Date(readAt).getTime()
        const mins = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)
        let timeAgo = 'just now'
        if (days > 0) timeAgo = `${days} day${days > 1 ? 's' : ''} ago`
        else if (hours > 0) timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`
        else if (mins > 0) timeAgo = `${mins} minute${mins > 1 ? 's' : ''} ago`
        return `Seen ${timeAgo}`
      }
      return 'Seen'
    }
    return 'Sent'
  }

  const handleBubbleClick = () => {
    if (isOwn && !isDeleted) {
      setShowStatusPopup((prev) => !prev)
    }
  }

  const handleReact = async (emoji) => {
    setShowEmojiPicker(false)
    if (socket) {
      socket.emit('react_message', { message_id: msg._id || msg.id, emoji, conversation_id: conversationId })
    } else {
      try {
        const { data } = await messageApi.react(msg._id || msg.id, emoji)
        // Update locally if socket not available
      } catch (_) { }
    }
  }

  const handleDelete = async (forAll) => {
    try {
      await messageApi.delete(msg._id || msg.id, forAll)
      deleteMessage(conversationId, msg._id || msg.id)
      toast.success(forAll ? 'Message deleted for everyone' : 'Message deleted')
    } catch (_) {
      toast.error('Failed to delete message')
    }
    setShowActions(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content?.text || '')
    toast.success('Copied')
    setShowActions(false)
  }

  const handleEdit = async () => {
    if (!editText.trim()) {
      toast.error('Message cannot be empty')
      return
    }

    if (editText === msg.content?.text) {
      setEditMode(false)
      return
    }

    // Check if message is older than 24 hours
    if (isOlderThan24Hours()) {
      toast.error('Messages cannot be edited after 24 hours')
      setEditMode(false)
      return
    }

    try {
      if (socket) {
        socket.emit('edit_message', {
          message_id: msg._id || msg.id,
          text: editText.trim(),
        })
      } else {
        await messageApi.edit(msg._id || msg.id, editText.trim())
      }

      // Update locally
      updateMessage(conversationId, msg._id || msg.id, {
        content: { ...msg.content, text: editText.trim() },
        is_edited: true,
        edited_at: new Date(),
      })

      setEditMode(false)
      toast.success('Message edited')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to edit message')
    }
  }

  const reactionSummary = getReactionSummary(msg.reactions || [])

  return (
    <div
      className={clsx(
        'group flex items-end gap-2 px-4 py-0.5 message-appear relative',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false) }}
    >
      {/* Avatar (only for received messages, first in a group) */}
      <div className="w-7 flex-shrink-0">
        {showAvatar && !isOwn && (
          <Avatar
            src={sender?.avatar_url}
            name={sender?.display_name}
            size="xs"
          />
        )}
      </div>

      {/* Message content */}
      <div className={clsx('max-w-[70%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name for group chats */}
        {showAvatar && !isOwn && sender?.display_name && (
          <span className="text-xs font-medium text-accent-yellow mb-1 ml-3">
            {sender.display_name}
          </span>
        )}

        {/* Reply preview */}
        {msg.reply_to && <ReplyPreview messageId={msg.reply_to} isOwn={isOwn} conversationId={conversationId} />}

        {/* Edit Mode */}
        {editMode && isOwn ? (
          <div className="w-full min-w-[260px] flex gap-2 items-center bg-bg-elevated border border-accent-yellow/40 rounded-xl px-3 py-2 mb-1 shadow-lg ring-1 ring-accent-yellow/15">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="flex-1 bg-bg-primary/80 border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-yellow/50"
              placeholder="Edit message..."
              autoFocus
            />
            <button
              onClick={handleEdit}
              className="px-3 py-2 bg-accent-yellow text-black text-sm rounded-lg font-semibold hover:bg-accent-yellow-dim transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditMode(false)
                setEditText(msg.content?.text || '')
              }}
              className="px-3 py-2 bg-bg-primary border border-border text-text-primary text-sm rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {/* Bubble */}
            <div
              className={clsx(
                'relative cursor-pointer',
                isOwn ? 'message-bubble-sent' : 'message-bubble-received',
                isDeleted && 'opacity-60 italic'
              )}
              onClick={handleBubbleClick}
            >
              {isDeleted ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <AlertCircle className="w-3.5 h-3.5" />
                  This message was deleted
                </span>
              ) : (
                <MessageContent message={msg} onImageClick={() => setLightboxOpen(true)} />
              )}

              {/* Edited label */}
              {msg.edited_at && !isDeleted && (
                <span className="text-[10px] opacity-60 ml-1">(edited)</span>
              )}
            </div>

            {/* Status popup on click */}
            {showStatusPopup && isOwn && (
              <div className="mt-1 px-3 py-1.5 bg-bg-elevated border border-border rounded-xl shadow-lg text-xs text-text-secondary animate-scale-in">
                {getStatusLabel()}
              </div>
            )}

            {/* Time + status row */}
            <div className={clsx('flex items-center gap-1 mt-0.5 px-1', isOwn ? 'flex-row-reverse' : '')}>
              <span className="text-[11px] text-text-muted">{formatMessageTime(msg.created_at)}</span>
              <StatusIcon />
            </div>

            {/* Seen avatar — Messenger style: small profile pic below last read message */}
            {isOwn && msg.status === 'read' && isLastReadMessage && (
              <div className="flex justify-end pr-1 mt-0.5">
                <Avatar
                  src={msg.read_by?.reader_avatar_url}
                  name={msg.read_by?.reader_display_name || '?'}
                  size="2xs"
                />
              </div>
            )}

            {/* Reactions */}
            {reactionSummary.length > 0 && (
              <div className={clsx('flex items-center gap-1 mt-1 flex-wrap', isOwn ? 'justify-end' : 'justify-start')}>
                {reactionSummary.map(([emoji, count]) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={clsx(
                      'flex items-center gap-1 text-sm bg-bg-elevated border rounded-full px-2 py-0.5 transition-all reaction-btn',
                      hasReacted(msg.reactions, user?.id, emoji)
                        ? 'border-accent-yellow/50 bg-accent-yellow/10'
                        : 'border-border hover:border-border-subtle'
                    )}
                  >
                    <span>{emoji}</span>
                    <span className="text-[11px] text-text-secondary">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons (appear on hover) */}
      {showActions && !isDeleted && (
        <div
          className={clsx(
            'flex items-center gap-1 self-center animate-fade-in',
            isOwn ? 'flex-row-reverse mr-2' : 'ml-2'
          )}
        >
          {/* Emoji react */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="icon-btn"
              title="React"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showEmojiPicker && (
              <div className={clsx('absolute bottom-10 z-50', isOwn ? 'right-0' : 'left-0')}>
                <ReactionPicker onSelect={handleReact} />
              </div>
            )}
          </div>

          {/* Reply */}
          <button
            onClick={() => setReplyTo(msg)}
            className="icon-btn"
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>

          {/* More actions */}
          <MessageActionsMenu
            isOwn={isOwn}
            onCopy={handleCopy}
            onDelete={handleDelete}
            onEdit={isOwn ? () => setEditMode(true) : undefined}
            canEdit={!isOlderThan24Hours()}
          />
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <MediaLightbox
          url={msg.content?.media_url}
          type={msg.message_type}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Message content renderer ─────────────────────────────────────────────────
function MessageContent({ message, onImageClick }) {
  const { message_type: type, content } = message

  if (type === 'image') {
    return (
      <div>
        <img
          src={content?.media_url}
          alt="Image"
          className="max-w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity max-h-80 object-cover"
          onClick={onImageClick}
          loading="lazy"
        />
        {content?.text && <p className="text-sm mt-2">{content.text}</p>}
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="relative cursor-pointer" onClick={onImageClick}>
        {content?.thumbnail_url ? (
          <img src={content.thumbnail_url} className="max-w-full rounded-xl max-h-64 object-cover" />
        ) : (
          <div className="w-64 h-36 bg-bg-primary rounded-xl flex items-center justify-center">
            <Play className="w-12 h-12 text-text-muted" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
          <Play className="w-10 h-10 text-white" />
        </div>
        {content?.duration && (
          <span className="absolute bottom-2 right-2 text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">
            {formatDuration(content.duration)}
          </span>
        )}
      </div>
    )
  }

  if (type === 'audio') {
    return <AudioMessageContent content={content} />
  }

  if (type === 'file') {
    return (
      <a
        href={content?.media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-[180px]"
      >
        <div className="w-10 h-10 bg-bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate max-w-[180px]">{content?.file_name || 'File'}</p>
          <p className="text-[11px] opacity-60">
            {content?.media_size ? formatFileSize(content.media_size) : ''}
          </p>
        </div>
      </a>
    )
  }

  if (type === 'location') {
    return (
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">{content?.location?.name || 'Location'}</p>
          <p className="text-[11px] opacity-60">Tap to view on map</p>
        </div>
      </div>
    )
  }

  // Default: text
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {content?.text || message.text}
    </p>
  )
}

function AudioMessageContent({ content }) {
  const [loadedDuration, setLoadedDuration] = useState(0)
  const resolvedDuration = Number(content?.duration || loadedDuration || 0)

  return (
    <div className="min-w-[220px]">
      <div className="flex items-center gap-2 mb-2 text-text-secondary">
        <Mic className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs">Voice message</span>
        <span className="text-[11px] opacity-70 ml-auto">
          {resolvedDuration > 0 ? formatDuration(resolvedDuration) : '--:--'}
        </span>
      </div>
      <audio
        controls
        preload="metadata"
        src={content?.media_url}
        className="w-full h-8"
        onLoadedMetadata={(e) => {
          const d = Number.isFinite(e.currentTarget.duration)
            ? Math.max(0, Math.round(e.currentTarget.duration))
            : 0
          if (d > 0) setLoadedDuration(d)
        }}
      />
    </div>
  )
}

// ─── Reaction quick-pick row ──────────────────────────────────────────────────
function QuickReactions({ onSelect }) {
  const QUICK = ['👍', '❤️', '😂', '😮', '😢', '😡']
  return (
    <div className="flex items-center gap-1 bg-bg-elevated border border-border rounded-2xl px-2 py-1.5 shadow-xl">
      {QUICK.map((e) => (
        <button
          key={e}
          onClick={() => onSelect(e)}
          className="text-xl hover:scale-125 transition-transform duration-150"
        >
          {e}
        </button>
      ))}
    </div>
  )
}

// ─── Message actions menu ─────────────────────────────────────────────────────
function MessageActionsMenu({ isOwn, onCopy, onDelete, onEdit, canEdit }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="icon-btn"
        title="More"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute bottom-8 right-0 z-50 bg-bg-elevated border border-border rounded-xl shadow-2xl py-1 min-w-[160px] animate-scale-in">
          <button
            onClick={() => { onCopy(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            Copy text
          </button>
          {isOwn && onEdit && canEdit && (
            <button
              onClick={() => { onEdit(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {isOwn && onEdit && !canEdit && (
            <button
              disabled
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted opacity-50 cursor-not-allowed"
              title="Messages cannot be edited after 24 hours"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          <button
            onClick={() => { onDelete(false); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-busy hover:bg-surface-hover transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete for me
          </button>
          {isOwn && (
            <button
              onClick={() => { onDelete(true); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-busy hover:bg-surface-hover transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete for everyone
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
