import { useRef, useState, useCallback, useEffect } from 'react'
import { initFaceLandmarker } from '@/lib/liveness/mediapipe-init'
import { detectChallenge, type Challenge } from '@/lib/liveness/challenges'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'

const CHALLENGES: Challenge[] = ['smile', 'blink', 'turn_left', 'turn_right']

export function useLiveness() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number>(0)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null)
  const [passed, setPassed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      landmarkerRef.current = await initFaceLandmarker()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      // Pick random challenge
      const challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]
      setCurrentChallenge(challenge)
      runLoop(challenge)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera access denied')
    } finally {
      setLoading(false)
    }
  }, [])

  function runLoop(challenge: Challenge) {
    const video = videoRef.current
    const landmarker = landmarkerRef.current
    if (!video || !landmarker) return

    const tick = () => {
      if (video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now())
        if (detectChallenge(result, challenge)) {
          cancelAnimationFrame(rafRef.current)
          setPassed(true)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      // Stop camera on unmount
      const stream = videoRef.current?.srcObject as MediaStream | null
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return { videoRef, currentChallenge, passed, loading, error, start }
}
