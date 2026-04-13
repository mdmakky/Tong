import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import {
  Send, Paperclip, Smile, X, Mic, Square, Image as ImageIcon
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import { conversationApi, groupApi } from '@/lib/apiServices'
import Avatar from '@/components/ui/Avatar'

const MAX_TEXT_LENGTH = 4000
const EmojiPicker = lazy(() => import('emoji-picker-react'))

export default function MessageInput({ conversationId, conversationType }) {
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [attachedFiles, setAttachedFiles] = useState([])

  const textareaRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const typingTimerRef = useRef(null)
  const recordingIntervalRef = useRef(null)
  const recordingTimeRef = useRef(0)
  const emojiPanelRef = useRef(null)

  const { replyTo, clearReplyTo, appendMessage, replaceMessage, removeMessage, upsertConversation, upsertGroup, activeConversation, activeType } = useChatStore()
  const { user } = useAuthStore()
  const socket = useChatStore((s) => s.socket)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [text])

  // Focus input when conversation changes
  useEffect(() => {
    if (!conversationId) return
    textareaRef.current?.focus()
  }, [conversationId])

  // Focus input when reply is triggered
  useEffect(() => {
    if (!replyTo) return
    textareaRef.current?.focus()
  }, [replyTo])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current)
      clearInterval(recordingIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    recordingTimeRef.current = recordingTime
  }, [recordingTime])

  // Close emoji picker on outside click or Escape for predictable dismissal behavior.
  useEffect(() => {
    if (!showEmoji) return

    const handlePointerDown = (event) => {
      if (!emojiPanelRef.current) return
      if (!emojiPanelRef.current.contains(event.target)) {
        setShowEmoji(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowEmoji(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showEmoji])

  // Typing events
  const emitTyping = useCallback(() => {
    if (!socket || !conversationId) return
    socket.emit('typing_start', { conversation_id: conversationId })
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing_stop', { conversation_id: conversationId })
    }, 2000)
  }, [socket, conversationId])

  const handleTextChange = (e) => {
    const val = e.target.value
    if (val.length > MAX_TEXT_LENGTH) return
    setText(val)
    if (val) emitTyping()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed && attachedFiles.length === 0) return
    if (sending) return

    setSending(true)
    setShowEmoji(false)
    socket?.emit('typing_stop', { conversation_id: conversationId })

    // Clear input immediately for snappy UX
    const sendText = trimmed
    const sendReplyTo = replyTo
    setText('')
    setAttachedFiles([])
    clearReplyTo()

    try {
      const api = conversationType === 'group' ? groupApi : conversationApi
      const firstAttachment = attachedFiles[0]
      const detectedType = firstAttachment ? detectFileType(firstAttachment) : 'text'
      const payloadContent = { text: sendText }

      if (detectedType === 'audio') {
        const duration = Number(firstAttachment?.duration || 0)
        if (duration > 0) payloadContent.duration = duration
      }

      const payload = {
        content: payloadContent,
        message_type: detectedType,
        reply_to: sendReplyTo?._id || sendReplyTo?.id || undefined,
      }

      if (attachedFiles.length > 0) {
        // Upload files via multipart — no optimistic for files
        const form = new FormData()
        form.append('file', firstAttachment.file)
        form.append('content', JSON.stringify(payload.content))
        form.append('message_type', payload.message_type)
        if (payload.reply_to) form.append('reply_to', payload.reply_to)

        const { data } = await api.sendMessage(conversationId, form)
        appendMessage(conversationId, data.data)
      } else {
        if (socket) {
          // Optimistic: show immediately with pending status
          const tempId = `temp-${Date.now()}`
          const optimistic = {
            _id: tempId,
            conversation_id: conversationId,
            sender_id: user?.id,
            sender: {
              id: user?.id,
              username: user?.username,
              display_name: user?.display_name,
              avatar_url: user?.avatar_url,
            },
            message_type: payload.message_type,
            content: payload.content,
            reply_to: payload.reply_to || null,
            reactions: [],
            status: 'pending',
            created_at: new Date().toISOString(),
          }
          appendMessage(conversationId, optimistic)

          socket.emit('send_message', {
            conversation_id: conversationId,
            conversation_type: conversationType,
            content: payload.content,
            message_type: payload.message_type,
            reply_to: payload.reply_to,
          }, (response) => {
            if (response?.success) {
              // Replace optimistic msg with the real one (status comes from server: 'sent' or 'delivered')
              const realMsg = { ...response.message, status: response.message.status || 'sent' }
              replaceMessage(conversationId, tempId, realMsg)

              // Update sidebar conversation/group with new last message
              if (conversationType === 'group') {
                upsertGroup({
                  id: conversationId,
                  last_message: realMsg,
                  last_message_at: realMsg.created_at,
                })
              } else {
                upsertConversation({
                  id: conversationId,
                  last_message: realMsg,
                  last_message_at: realMsg.created_at,
                })
              }
            } else {
              // Remove the optimistic message and show error
              removeMessage(conversationId, tempId)
              toast.error(response?.error || 'Failed to send message')
            }
          })
        } else {
          const { data } = await api.sendMessage(conversationId, payload)
          const message = data.data
          appendMessage(conversationId, message)

          // Update sidebar conversation/group with new last message
          if (conversationType === 'group') {
            upsertGroup({
              id: conversationId,
              last_message: message,
              last_message_at: message.created_at,
            })
          } else {
            upsertConversation({
              id: conversationId,
              last_message: message,
              last_message_at: message.created_at,
            })
          }
        }
      }
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // File drop
  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    noClick: true,
    noKeyboard: true,
    accept: {
      'image/*': [],
      'video/*': [],
      'audio/*': [],
      'application/pdf': [],
      'application/msword': [],
      'application/vnd.openxmlformats-officedocument.*': [],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    onDrop: async (accepted) => {
      const previews = await Promise.all(accepted.map(async (f) => ({
        file: f,
        name: f.name,
        size: f.size,
        type: f.type,
        duration: f.type.startsWith('audio/') ? await getAudioDuration(f) : undefined,
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      })))
      setAttachedFiles(previews.slice(0, 5)) // max 5
    },
    onDropRejected: () => toast.error('File too large or unsupported format'),
  })

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      mediaRecorder.onstop = () => {
        const voiceDuration = Math.max(1, recordingTimeRef.current)
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
        setAttachedFiles([{ file, name: file.name, size: file.size, type: 'audio/webm', isVoice: true, duration: voiceDuration }])
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        clearInterval(recordingIntervalRef.current)
        setRecordingTime(0)
        recordingTimeRef.current = 0
      }

      mediaRecorder.start()
      setRecording(true)
      setRecordingTime(0)
      recordingTimeRef.current = 0
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    } catch (_) {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
  }

  const cancelRecording = () => {
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop())
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    clearInterval(recordingIntervalRef.current)
    setRecordingTime(0)
    recordingTimeRef.current = 0
  }

  const formatRecTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="border-t border-border bg-bg-primary px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
      {/* Drag overlay */}
      <div {...getRootProps()} className="relative">
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-primary/90 border-2 border-dashed border-accent-yellow rounded-2xl">
            <p className="text-accent-yellow font-medium">Drop files to attach</p>
          </div>
        )}

        {/* Reply preview bar */}
        {replyTo && (
          <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl px-3 py-2 mb-2">
            <div className="w-0.5 h-8 bg-accent-yellow rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-accent-yellow">
                {replyTo.sender?.display_name || 'You'}
              </p>
              <p className="text-xs text-text-muted truncate">
                {replyTo.content?.text || `[${replyTo.message_type || 'media'}]`}
              </p>
            </div>
            <button onClick={clearReplyTo} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {attachedFiles.map((f, i) => (
              <div key={i} className="relative group">
                {f.preview ? (
                  <img src={f.preview} className="w-16 h-16 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-bg-elevated border border-border flex flex-col items-center justify-center gap-1 px-1">
                    <span className="text-text-muted text-xs text-center truncate w-full px-1">{f.name}</span>
                    {f.duration ? (
                      <span className="text-[10px] text-text-secondary">{formatRecTime(f.duration)}</span>
                    ) : null}
                  </div>
                )}
                <button
                  onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-busy rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Voice recording bar */}
        {recording ? (
          <div className="flex items-center gap-3 bg-bg-elevated border border-busy/30 rounded-2xl px-4 py-3">
            <div className="w-3 h-3 bg-busy rounded-full recording-pulse flex-shrink-0" />
            <span className="text-sm text-text-primary font-medium">{formatRecTime(recordingTime)}</span>
            <div className="flex-1" />
            <button
              onClick={cancelRecording}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={stopRecording}
              className="w-10 h-10 bg-accent-yellow rounded-xl flex items-center justify-center text-black hover:bg-accent-yellow-dim transition-colors"
              title="Send voice message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Normal input row */
          <div className="flex items-end gap-2">
            {/* Attach button */}
            <button
              onClick={openFilePicker}
              className="icon-btn flex-shrink-0 mb-0.5"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Text input */}
            <div className="flex-1 relative flex items-end bg-bg-elevated border border-border rounded-2xl px-4 py-2.5 focus-within:border-accent-yellow/30 transition-colors">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Write a message..."
                rows={1}
                className="flex-1 bg-transparent text-text-primary text-[16px] md:text-sm placeholder:text-text-muted resize-none focus:outline-none leading-relaxed max-h-40"
                style={{ height: 'auto', minHeight: '24px' }}
              />
              {/* Emoji button */}
              <div ref={emojiPanelRef} className="relative ml-2 flex-shrink-0">
                <button
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="text-text-muted hover:text-text-secondary transition-colors"
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                {showEmoji && (
                  <div className="absolute bottom-10 right-0 z-50">
                    <Suspense
                      fallback={
                        <div className="w-80 h-96 bg-bg-elevated border border-border rounded-2xl flex items-center justify-center text-xs text-text-muted">
                          Loading emojis...
                        </div>
                      }
                    >
                      <EmojiPicker
                        onEmojiClick={(e) => {
                          setText((prev) => prev + e.emoji)
                          textareaRef.current?.focus()
                        }}
                        theme="dark"
                        width={320}
                        height={380}
                        searchDisabled={false}
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>

            {/* Send / Mic button */}
            {text.trim() || attachedFiles.length > 0 ? (
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-10 h-10 bg-accent-yellow rounded-xl flex items-center justify-center text-black hover:bg-accent-yellow-dim transition-colors flex-shrink-0 disabled:opacity-70"
                title="Send"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="w-10 h-10 bg-bg-elevated border border-border rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors flex-shrink-0"
                title="Voice message"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

async function getAudioDuration(file) {
  return new Promise((resolve) => {
    const tempUrl = URL.createObjectURL(file)
    const audio = new Audio()

    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(tempUrl)
      const duration = Number.isFinite(audio.duration) ? Math.max(0, Math.round(audio.duration)) : 0
      resolve(duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(tempUrl)
      resolve(0)
    }

    audio.src = tempUrl
  })
}

function detectFileType(f) {
  if (!f) return 'text'
  if (f.type.startsWith('image/')) return 'image'
  if (f.type.startsWith('video/')) return 'video'
  if (f.type.startsWith('audio/') || f.isVoice) return 'audio'
  return 'file'
}
