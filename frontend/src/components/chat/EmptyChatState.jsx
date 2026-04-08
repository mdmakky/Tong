export default function EmptyChatState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary text-center p-8">
      <div className="flex items-center justify-center mb-6">
        <img src="/tong-icon.svg" alt="tong" className="w-24 h-24 opacity-60" />
      </div>
      <h3 className="text-xl font-semibold text-text-primary mb-2">Welcome to tong</h3>
      <p className="text-text-secondary text-sm max-w-xs leading-relaxed">
        Select a conversation from the sidebar or start a new chat to begin messaging.
      </p>
    </div>
  )
}
