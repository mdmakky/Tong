import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns'

/**
 * Format a message timestamp to human-readable form
 */
export function formatMessageTime(date) {
  if (!date) return ''
  const d = new Date(date)
  return format(d, 'h:mm a')
}

/**
 * Format a conversation list item date (smart: Today -> time, Yesterday, etc.)
 */
export function formatConvTime(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  if (isThisWeek(d)) return format(d, 'EEE')
  if (isThisYear(d)) return format(d, 'MMM d')
  return format(d, 'MM/dd/yy')
}

/**
 * Format a date separator in message list
 */
export function formatDateSeparator(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  if (isThisWeek(d)) return format(d, 'EEEE')
  if (isThisYear(d)) return format(d, 'MMMM d')
  return format(d, 'MMMM d, yyyy')
}

/**
 * Format last seen for profile display
 */
export function formatLastSeen(date) {
  if (!date) return 'a while ago'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

/**
 * Resolve the effective presence status shown in UI.
 * Live socket status has priority; profile fallback never treats plain "online" as authoritative.
 */
export function resolvePresenceStatus(liveStatus, profileStatus) {
  const normalize = (status) => {
    if (status === 'invisible') return 'offline'
    if (status === 'online' || status === 'away' || status === 'busy' || status === 'offline') {
      return status
    }
    return null
  }

  const live = normalize(liveStatus)
  if (live) return live

  // Keep meaningful custom states from profile, but do not trust stale "online" values.
  if (profileStatus === 'away' || profileStatus === 'busy') return profileStatus
  if (profileStatus === 'invisible') return 'offline'
  return 'offline'
}

/**
 * Get initials from a display name
 */
export function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('')
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str, n = 40) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

/**
 * Format file size to human-readable
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Get status color class
 */
export function getStatusColor(status) {
  switch (status) {
    case 'online': return 'bg-online'
    case 'away': return 'bg-away'
    case 'busy': return 'bg-busy'
    default: return 'bg-text-muted'
  }
}

/**
 * Group messages by date for rendering separators
 */
export function groupMessagesByDate(messages) {
  const groups = []
  let lastDate = null

  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toDateString()
    if (msgDate !== lastDate) {
      groups.push({ type: 'separator', date: msg.created_at, key: msgDate })
      lastDate = msgDate
    }
    groups.push({ type: 'message', data: msg, key: msg._id || msg.id })
  }

  return groups
}

/**
 * Check if a message is from the current user
 */
export function isOwnMessage(msg, currentUserId) {
  return msg.sender_id === currentUserId || msg.sender?.id === currentUserId
}

/**
 * Get dominant reaction from message
 */
export function getReactionSummary(reactions = []) {
  const counts = {}
  for (const r of reactions) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
}

/**
 * Check if current user reacted with emoji
 */
export function hasReacted(reactions = [], currentUserId, emoji) {
  return reactions.some((r) => r.user_id === currentUserId && r.emoji === emoji)
}

/**
 * Build avatar URL with fallback
 */
export function avatarUrl(url, name) {
  if (url) return url
  // Generate a deterministic color based on name
  const colors = ['#e8d44d', '#4ade80', '#60a5fa', '#f97316', '#a78bfa', '#f43f5e']
  const idx = name ? name.charCodeAt(0) % colors.length : 0
  return null // Will use initials avatar component
}

/**
 * Determine message status icon
 */
export function getMessageStatus(msg) {
  if (msg.status === 'read' || (msg.read_receipts && msg.read_receipts.length > 0)) return 'read'
  if (msg.status === 'delivered' || (msg.delivered_to && msg.delivered_to.length > 0)) return 'delivered'
  if (msg.status === 'sent') return 'sent'
  return 'pending'
}
