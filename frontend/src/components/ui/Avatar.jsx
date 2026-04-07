import clsx from 'clsx'
import { getInitials } from '@/utils/helpers'

const SIZE_MAP = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl',
}

const STATUS_MAP = {
  online: 'bg-online',
  away: 'bg-away',
  busy: 'bg-busy',
  offline: 'bg-bg-elevated border border-border',
  invisible: 'bg-bg-elevated border border-border',
}

const STATUS_DOT_SIZE = {
  xs: 'w-2 h-2',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
}

export default function Avatar({ src, name, size = 'md', status, className }) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md
  const initials = getInitials(name)

  // Deterministic background color from name
  const colors = [
    'bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-violet-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
  ]
  const colorIdx = name ? name.charCodeAt(0) % colors.length : 0
  const bgColor = colors[colorIdx]

  return (
    <div className="relative flex-shrink-0">
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={clsx('avatar', sizeClass, className)}
        />
      ) : (
        <div
          className={clsx(
            'avatar flex items-center justify-center font-semibold text-white',
            sizeClass,
            bgColor,
            className
          )}
        >
          {initials || '?'}
        </div>
      )}

      {/* Status dot */}
      {status && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-bg-primary',
            STATUS_DOT_SIZE[size] || STATUS_DOT_SIZE.md,
            STATUS_MAP[status] || STATUS_MAP.offline
          )}
        />
      )}
    </div>
  )
}
