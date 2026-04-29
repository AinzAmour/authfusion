import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

export function useHandoffSocket(sessionId: string | null, onComplete: () => void) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const socket = io('/', {
      path: '/socket.io',
      reconnection: true,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join-handoff', sessionId)
    })

    socket.on('handoff-complete', () => {
      onComplete()
    })

    return () => {
      socket.disconnect()
    }
  }, [sessionId, onComplete])

  return socketRef.current
}
