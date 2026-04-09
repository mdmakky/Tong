const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡']

export default function ReactionPicker({ onSelect }) {
  return (
    <div className="flex items-center gap-1 bg-bg-elevated border border-border rounded-2xl px-2.5 py-2 shadow-2xl animate-scale-in">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="text-xl hover:scale-125 transition-transform duration-150 w-8 h-8 flex items-center justify-center"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
