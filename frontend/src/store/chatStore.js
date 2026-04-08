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

  // Socket instance (stored here so React can react to changes)
  socket: null,

  // UI state
  replyTo: null,
  searchQuery: '',
  sidebarTab: 'chats', // 'chats' | 'groups' | 'contacts'
  showInfoPanel: true,

  // ─── Actions ──────────────────────────────────────────────

  setSocket: (s) => set({ socket: s }),

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

  removeConversation: (convId) =>
    set((state) => {
      const isActiveDirect =
        state.activeType === 'direct' && state.activeConversation?.id === convId

      return {
        conversations: state.conversations.filter((c) => c.id !== convId),
        messages: Object.fromEntries(
          Object.entries(state.messages).filter(([id]) => id !== convId)
        ),
        hasMore: Object.fromEntries(
          Object.entries(state.hasMore).filter(([id]) => id !== convId)
        ),
        loadingMessages: Object.fromEntries(
          Object.entries(state.loadingMessages).filter(([id]) => id !== convId)
        ),
        typingUsers: Object.fromEntries(
          Object.entries(state.typingUsers).filter(([id]) => id !== convId)
        ),
        unreadCounts: Object.fromEntries(
          Object.entries(state.unreadCounts).filter(([id]) => id !== convId)
        ),
        activeConversation: isActiveDirect ? null : state.activeConversation,
        activeType: isActiveDirect ? null : state.activeType,
        replyTo: isActiveDirect ? null : state.replyTo,
      }
    }),

  setConversations: (convs) =>
    set((state) => {
      const unreadFromApi = Object.fromEntries(
        (convs || []).map((c) => [c.id, c.unread_count || 0])
      )
      return {
        conversations: convs,
        unreadCounts: { ...state.unreadCounts, ...unreadFromApi },
      }
    }),

  upsertConversation: (conv) => {
    set((state) => {
      const exists = state.conversations.find((c) => c.id === conv.id)
      const newConvs = exists
        ? state.conversations.map((c) => (c.id === conv.id ? { ...c, ...conv } : c))
        : [conv, ...state.conversations]
      // Also update activeConversation if it's the same conversation
      const newActive =
        state.activeConversation?.id === conv.id
          ? { ...state.activeConversation, ...conv }
          : state.activeConversation
      return { conversations: newConvs, activeConversation: newActive }
    })
  },

  setGroups: (groups) =>
    set((state) => {
      const unreadFromApi = Object.fromEntries(
        (groups || []).map((g) => [g.id, g.unread_count || 0])
      )
      return {
        groups,
        unreadCounts: { ...state.unreadCounts, ...unreadFromApi },
      }
    }),

  upsertGroup: (group) => {
    set((state) => {
      const exists = state.groups.find((g) => g.id === group.id)
      const newGroups = exists
        ? state.groups.map((g) => (g.id === group.id ? { ...g, ...group } : g))
        : [group, ...state.groups]

      const newActive =
        state.activeType === 'group' && state.activeConversation?.id === group.id
          ? { ...state.activeConversation, ...group }
          : state.activeConversation

      return { groups: newGroups, activeConversation: newActive }
    })
  },

  removeGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      messages: Object.fromEntries(
        Object.entries(state.messages).filter(([convId]) => convId !== groupId)
      ),
      activeConversation:
        state.activeType === 'group' && state.activeConversation?.id === groupId
          ? null
          : state.activeConversation,
      activeType:
        state.activeType === 'group' && state.activeConversation?.id === groupId
          ? null
          : state.activeType,
    })),

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

  replaceMessage: (convId, tempId, realMsg) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] || []).map((m) =>
          (m._id || m.id) === tempId ? realMsg : m
        ),
      },
    }))
  },

  removeMessage: (convId, msgId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] || []).filter(
          (m) => (m._id || m.id) !== msgId
        ),
      },
    }))
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
