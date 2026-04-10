import api from '@/lib/api'

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: (refresh_token) => api.post('/auth/refresh', { refresh_token }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  verifyEmail: (data) => api.post('/auth/verify-email', data),
}

// ─── Users ───────────────────────────────────────────────────────────────────
export const userApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  uploadAvatar: (file) => {
    const form = new FormData()
    form.append('avatar', file)
    return api.post('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  search: (q) => api.get('/users/search', { params: { q } }),
  getUser: (id) => api.get(`/users/${id}`),
  block: (id) => api.post(`/users/${id}/block`),
  unblock: (id) => api.delete(`/users/${id}/block`),
  report: (id, reason) => api.post(`/users/${id}/report`, { reason }),
}

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversationApi = {
  list: () => api.get('/conversations'),
  create: (participantId) => api.post('/conversations', { participant_id: participantId }),
  get: (id) => api.get(`/conversations/${id}`),
  delete: (id) => api.delete(`/conversations/${id}`),
  getMessages: (id, params) => api.get(`/conversations/${id}/messages`, { params }),
  sendMessage: (id, data) => api.post(`/conversations/${id}/messages`, data),
  getMedia: (id) => api.get(`/conversations/${id}/media`),
  acceptRequest: (id) => api.post(`/conversations/${id}/accept-request`),
  declineRequest: (id) => api.post(`/conversations/${id}/decline-request`),
  setNickname: (id, nickname) => api.put(`/conversations/${id}/nickname`, { nickname }),
  getNickname: (id) => api.get(`/conversations/${id}/nickname`),
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messageApi = {
  edit: (id, content) => api.put(`/messages/${id}`, { text: content }),
  delete: (id, forAll = false) =>
    api.delete(`/messages/${id}`, { data: { for_all: forAll } }),
  react: (id, emoji) => api.post(`/messages/${id}/reactions`, { emoji }),
  pin: (id) => api.post(`/messages/${id}/pin`),
}

// ─── Groups ───────────────────────────────────────────────────────────────────
export const groupApi = {
  list: () => api.get('/groups'),
  searchPublic: (q, params = {}) => api.get('/groups/public/search', { params: { q, ...params } }),
  checkUniqueId: (uniqueGroupId) => api.get(`/groups/check-unique-id/${encodeURIComponent(uniqueGroupId)}`),
  create: (data) => api.post('/groups', data),
  get: (id) => api.get(`/groups/${id}`),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`),
  getMembers: (id) => api.get(`/groups/${id}/members`),
  addMember: (id, userId) => api.post(`/groups/${id}/members`, { user_id: userId }),
  removeMember: (id, userId) => api.delete(`/groups/${id}/members/${userId}`),
  updateRole: (id, userId, role) =>
    api.put(`/groups/${id}/members/${userId}/role`, { role }),
  muteMember: (id, userId, duration) =>
    api.post(`/groups/${id}/members/${userId}/mute`, { duration }),
  join: (inviteLink) => api.post(`/groups/join/${inviteLink}`),
  joinPublic: (id) => api.post(`/groups/${id}/join`),
  leave: (id) => api.post(`/groups/${id}/leave`),
  getMessages: (id, params) => api.get(`/groups/${id}/messages`, { params }),
  sendMessage: (id, data) => api.post(`/groups/${id}/messages`, data),
  getMedia: (id, params) => api.get(`/groups/${id}/media`, { params }),
  uploadAvatar: (id, file) => {
    const form = new FormData()
    form.append('avatar', file)
    return api.put(`/groups/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ─── File upload helper ───────────────────────────────────────────────────────
export const uploadMedia = (conversationId, file, type = 'conversation') => {
  const form = new FormData()
  form.append('file', file)
  const url = type === 'group'
    ? `/groups/${conversationId}/messages/media`
    : `/conversations/${conversationId}/messages/media`
  return api.post(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
