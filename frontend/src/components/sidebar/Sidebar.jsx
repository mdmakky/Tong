import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  MessageSquare, Users, UserSearch, Settings, Plus, LogOut, Bell
} from 'lucide-react'
import clsx from 'clsx'
import useChatStore from '@/store/chatStore'
import useAuthStore from '@/store/authStore'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import ConversationList from './ConversationList'
import GroupList from './GroupList'
import ContactSearch from './ContactSearch'
import UserSettingsModal from '@/components/modals/UserSettingsModal'
import NewChatModal from '@/components/modals/NewChatModal'

const TABS = [
  { id: 'chats', icon: MessageSquare, label: 'Chats' },
  { id: 'groups', icon: Users, label: 'Groups' },
  { id: 'contacts', icon: UserSearch, label: 'Find' },
]

export default function Sidebar() {
  const { sidebarTab, setSidebarTab, unreadCounts, conversations, groups } = useChatStore()
  const { user, logout } = useAuthStore()
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('profile')
  const [showNewChat, setShowNewChat] = useState(false)

  const openProfile = () => { setSettingsTab('profile'); setShowSettings(true) }
  const openSettings = () => { setSettingsTab('appearance'); setShowSettings(true) }

  // Calculate unread counts per tab
  const chatsUnread = conversations.reduce((sum, conv) => sum + (unreadCounts[conv.id] || 0), 0)
  const groupsUnread = groups.reduce((sum, group) => sum + (unreadCounts[group.id] || 0), 0)

  const statusColor = {
    online: 'bg-online',
    away: 'bg-away',
    busy: 'bg-busy',
    invisible: 'bg-border',
  }[user?.online_status || 'online']

  return (
    <div className="flex h-full">
      {/* Icon nav strip */}
      <div className="w-[60px] flex-shrink-0 bg-bg-secondary flex flex-col items-center py-4 gap-1 border-r border-border">
        {/* Logo */}
        <div className="w-10 h-10 flex items-center justify-center mb-4">
          <img src="/tong-icon.svg" alt="tong" className="w-10 h-10" />
        </div>

        {/* Tab buttons */}
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            className={clsx(
              'w-10 h-10 flex items-center justify-center rounded-xl transition-colors duration-150 relative',
              sidebarTab === tab.id
                ? 'bg-surface-active text-accent-yellow'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
            )}
            title={tab.label}
          >
            <tab.icon className="w-5 h-5" />
            {tab.id === 'chats' && chatsUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent-yellow rounded-full text-black text-[10px] font-bold flex items-center justify-center">
                {chatsUnread > 9 ? '9+' : chatsUnread}
              </span>
            )}
            {tab.id === 'groups' && groupsUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent-yellow rounded-full text-black text-[10px] font-bold flex items-center justify-center">
                {groupsUnread > 9 ? '9+' : groupsUnread}
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        {/* Notifications */}
        <button className="w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        {/* Settings */}
        <button
          onClick={openSettings}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User avatar */}
        <button
          onClick={openProfile}
          className="mt-2 relative"
          title={user?.display_name}
        >
          <Avatar src={user?.avatar_url} name={user?.display_name} size="sm" />
          <span className={clsx('absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-bg-secondary', statusColor)} />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-secondary">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary capitalize">{sidebarTab}</h2>
          <button
            onClick={() => setShowNewChat(true)}
            className="w-8 h-8 bg-accent-yellow rounded-lg flex items-center justify-center text-black hover:bg-accent-yellow-dim transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {sidebarTab === 'chats' && <ConversationList />}
          {sidebarTab === 'groups' && <GroupList />}
          {sidebarTab === 'contacts' && <ContactSearch />}
        </div>
      </div>

      {/* Modals */}
      {showSettings && <UserSettingsModal initialTab={settingsTab} onClose={() => setShowSettings(false)} />}
      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </div>
  )
}
