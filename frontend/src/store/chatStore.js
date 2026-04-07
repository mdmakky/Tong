import { create } from 'zustand'

const useChatStore = create((set, get) => ({
  // Active conversation/group
  activeConversation: null,
  activeType: null, // 'direct' | 'group'

  // Conversations & groups list
  conversations: [],
  groups: [],

  // Messages per conversation (keyed by conversation id)
  messages: {},
  hasMore: {},
  loadingMessages: {},

  // Typing indicators
  typingUsers: {}, // { convId: [{ user_id, display_name }] }

  // Unread counts
  unreadCounts: {}, // { convId: number }

  // Presence (online status)
  presenceMap: {}, // { userId: { status, last_seen } }

  // UI state
  replyTo: null,
  searchQuery: '',
  sidebarTab: 'chats', // 'chats' | 'groups' | 'contacts'
  showInfoPanel: true,

  // ─── Actions ──────────────────────────────────────────────

  setActiveConversation: (conv, type) => {
    set({
      activeConversation: conv,
      activeType: type,
      replyTo: null,
    })
    // Clear unread
    if (conv) {
      set((state) => ({
        unreadCounts: { ...state.unreadCounts, [conv.id]: 0 },
      }))
    }
  },

  setConversations: (convs) => set({ conversations: convs }),

  upsertConversation: (conv) => {
    set((state) => {
      const exists = state.conversations.find((c) => c.id === conv.id)
      if (exists) {
        return {
          conversations: state.conversations.map((c) => (c.id === conv.id ? { ...c, ...conv } : c)),
        }
      }
      return { conversations: [conv, ...state.conversations] }
    })
  },

  setGroups: (groups) => set({ groups }),

  upsertGroup: (group) => {
    set((state) => {
      const exists = state.groups.find((g) => g.id === group.id)
      if (exists) {
        return { groups: state.groups.map((g) => (g.id === group.id ? { ...g, ...group } : g)) }
      }
      return { groups: [group, ...state.groups] }
    })
  },

  // Messages
  setMessages: (convId, msgs, append = false) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: append
          ? [...(msgs || []), ...(state.messages[convId] || [])]
          : msgs,
      },
    }))
  },

  appendMessage: (convId, msg) => {
    set((state) => {
      const existing = state.messages[convId] || []
      const msgId = msg._id || msg.id
      if (msgId && existing.some((m) => (m._id || m.id) === msgId)) return {}
      return {
        messages: {
          ...state.messages,
          [convId]: [...existing, msg],
        },
      }
    })
  },

  updateMessage: (convId, msgId, updates) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] || []).map((m) =>
          m._id === msgId || m.id === msgId ? { ...m, ...updates } : m
        ),
      },
    }))
  },

  deleteMessage: (convId, msgId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] || []).map((m) =>
          m._id === msgId || m.id === msgId
            ? { ...m, is_deleted_for_all: true, content: { ...m.content, text: 'This message was deleted' } }
            : m
        ),
      },
    }))
  },

  setHasMore: (convId, val) =>
    set((state) => ({ hasMore: { ...state.hasMore, [convId]: val } })),

  setLoadingMessages: (convId, val) =>
    set((state) => ({ loadingMessages: { ...state.loadingMessages, [convId]: val } })),

  // Typing
  setUserTyping: (convId, user, isTyping) => {
    set((state) => {
      const current = state.typingUsers[convId] || []
      if (isTyping) {
        const exists = current.find((u) => u.user_id === user.user_id)
        if (exists) return {}
        return { typingUsers: { ...state.typingUsers, [convId]: [...current, user] } }
      } else {
        return {
          typingUsers: {
            ...state.typingUsers,
            [convId]: current.filter((u) => u.user_id !== user.user_id),
          },
        }
      }
    })
  },

  // Unread
  incrementUnread: (convId) => {
    const active = get().activeConversation
    if (active?.id === convId) return
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [convId]: (state.unreadCounts[convId] || 0) + 1,
      },
    }))
  },

  clearUnread: (convId) =>
    set((state) => ({ unreadCounts: { ...state.unreadCounts, [convId]: 0 } })),

  // Presence
  updatePresence: (userId, status, lastSeen) => {
    set((state) => ({
      presenceMap: {
        ...state.presenceMap,
        [userId]: { status, last_seen: lastSeen },
      },
    }))
  },

  // UI
  setReplyTo: (msg) => set({ replyTo: msg }),
  clearReplyTo: () => set({ replyTo: null }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  toggleInfoPanel: () => set((state) => ({ showInfoPanel: !state.showInfoPanel })),

  // Update reaction on a message
  updateReaction: (convId, msgId, reactions) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] || []).map((m) =>
          m._id === msgId || m.id === msgId ? { ...m, reactions } : m
        ),
      },
    }))
  },
}))

export default useChatStore
