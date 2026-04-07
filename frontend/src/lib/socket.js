import { io } from 'socket.io-client'
import useChatStore from '../store/chatStore.js'

export const getSocket = () => useChatStore.getState().socket

export const initSocket = (token) => {
  const existing = useChatStore.getState().socket
  if (existing?.connected) return existing

  const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  })

  // Store in Zustand so components reactively know when socket is ready
  useChatStore.getState().setSocket(socket)

  return socket
}

export const disconnectSocket = () => {
  const socket = useChatStore.getState().socket
  if (socket) {
    socket.disconnect()
    useChatStore.getState().setSocket(null)
  }
}
