export default function TypingIndicator({ names = [] }) {
  if (names.length === 0) return null

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names.length} people are typing`

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-text-muted animate-fade-in">
      <div className="flex items-center gap-0.5">
        <span className="typing-dot w-1.5 h-1.5 bg-text-muted rounded-full" />
        <span className="typing-dot w-1.5 h-1.5 bg-text-muted rounded-full" />
        <span className="typing-dot w-1.5 h-1.5 bg-text-muted rounded-full" />
      </div>
      <span>{label}</span>
    </div>
  )
}
