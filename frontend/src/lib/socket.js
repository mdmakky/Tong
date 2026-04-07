import { io } from 'socket.io-client'

let socket = null

export const getSocket = () => socket

export const initSocket = (token) => {
  if (socket?.connected) return socket

  socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  })

  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
