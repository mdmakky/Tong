import { useState, useRef } from 'react'
import { X, Camera, Save, LogOut, Moon, Sun, Monitor } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '@/store/authStore'
import { userApi } from '@/lib/apiServices'
import Avatar from '@/components/ui/Avatar'

const THEMES = [
  { id: 'dark', icon: Moon, label: 'Dark' },
  { id: 'light', icon: Sun, label: 'Light' },
  { id: 'system', icon: Monitor, label: 'System' },
]

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', color: 'bg-online' },
  { value: 'away', label: 'Away', color: 'bg-away' },
  { value: 'busy', label: 'Busy', color: 'bg-busy' },
  { value: 'invisible', label: 'Invisible', color: 'bg-text-muted' },
]

export default function UserSettingsModal({ onClose }) {
  const { user, logout, updateUser } = useAuthStore()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    bio: user?.bio || '',
    online_status: user?.online_status || 'online',
    custom_status: user?.custom_status || '',
    theme_preference: user?.theme_preference || 'system',
  })
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await userApi.updateMe(form)
      updateUser(data.data)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const { data } = await userApi.uploadAvatar(file)
      updateUser({ avatar_url: data.data.avatar_url })
      toast.success('Avatar updated')
    } catch (_) {
      toast.error('Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Settings</h2>
          <button onClick={onClose} className="icon-btn">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {['profile', 'appearance', 'privacy'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-accent-yellow border-b-2 border-accent-yellow'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-6 space-y-5">
          {activeTab === 'profile' && (
            <>
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar src={user?.avatar_url} name={user?.display_name} size="2xl" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-accent-yellow rounded-full flex items-center justify-center text-black hover:bg-accent-yellow-dim transition-colors shadow-md"
                  >
                    {uploadingAvatar ? (
                      <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div className="text-center">
                  <p className="font-medium text-text-primary">{user?.display_name}</p>
                  <p className="text-sm text-text-muted">@{user?.username}</p>
                </div>
              </div>

              {/* Display name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Display Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Bio</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  maxLength={500}
                  placeholder="Tell something about yourself..."
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
                <p className="text-xs text-text-muted text-right mt-1">{form.bio.length}/500</p>
              </div>

              {/* Online status */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setForm({ ...form, online_status: s.value })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
                        form.online_status === s.value
                          ? 'border-accent-yellow text-text-primary bg-accent-yellow/10'
                          : 'border-border text-text-secondary hover:border-border-subtle'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${s.color}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom status */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Custom Status</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder='e.g. "In a meeting"'
                  maxLength={200}
                  value={form.custom_status}
                  onChange={(e) => setForm({ ...form, custom_status: e.target.value })}
                />
              </div>
            </>
          )}

          {activeTab === 'appearance' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setForm({ ...form, theme_preference: t.id })}
                    className={`flex flex-col items-center gap-2 py-4 rounded-xl border transition-colors ${
                      form.theme_preference === t.id
                        ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                        : 'border-border text-text-secondary hover:border-border-subtle'
                    }`}
                  >
                    <t.icon className="w-5 h-5" />
                    <span className="text-xs">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <PrivacySetting
                label="Last seen"
                description="Who can see when you were last active"
                options={['everyone', 'contacts', 'nobody']}
                value={user?.last_seen_visibility || 'everyone'}
                onChange={() => {}}
              />
              <PrivacySetting
                label="Profile photo"
                description="Who can see your profile photo"
                options={['everyone', 'contacts', 'nobody']}
                value={user?.avatar_visibility || 'everyone'}
                onChange={() => {}}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button
            onClick={() => { logout(); onClose() }}
            className="flex items-center gap-2 text-sm text-busy hover:text-busy/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2">
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> Save</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PrivacySetting({ label, description, options, value, onChange }) {
  return (
    <div>
      <p className="text-sm font-medium text-text-primary mb-0.5">{label}</p>
      <p className="text-xs text-text-muted mb-2">{description}</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex-1 py-1.5 rounded-lg text-xs border capitalize transition-colors ${
              value === opt
                ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                : 'border-border text-text-secondary hover:border-border/80'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
