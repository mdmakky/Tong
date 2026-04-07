import { formatDateSeparator } from '@/utils/helpers'

export default function DateSeparator({ date }) {
  return (
    <div className="flex items-center gap-3 px-6 py-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-text-muted font-medium px-3 py-1 bg-bg-elevated rounded-full">
        {formatDateSeparator(date)}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
