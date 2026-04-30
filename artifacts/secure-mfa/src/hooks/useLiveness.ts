import { useRef, useState, useCallback, useEffect } from 'react'
import { initFaceLandmarker } from '@/lib/liveness/mediapipe-init'
import { detectChallenge, type Challenge } from '@/lib/liveness/challenges'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'

const CHALLENGES: Challenge[] = ['smile', 'blink', 'turn_left', 'turn_right']
const STABILITY_THRESHOLD = 8 // Default consecutive frames required

function requiredStability(challenge: Challenge): number {
  if (challenge === 'blink') return 2
  return STABILITY_THRESHOLD
}

export function useLiveness() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number>(0)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null)
  const [passed, setPassed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stabilityCounterRef = useRef(0)
  const loadingRef = useRef(false)

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    const stream = videoRef.current?.srcObject as MediaStream | null
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      videoRef.current!.srcObject = null
    }
  }, [])

  const start = useCallback(async () => {
    // Prevent multiple starts
    if (loadingRef.current) return
    loadingRef.current = true
    stop()
    
    setLoading(true)
    setError(null)
    setPassed(false)
    stabilityCounterRef.current = 0

    try {
      if (!landmarkerRef.current) {
        landmarkerRef.current = await initFaceLandmarker()
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          facingMode: 'user' 
        },
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
      console.error("Liveness Start Error:", err)
      setError(err instanceof Error ? err.message : 'Camera access denied')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [stop])

  const runLoop = useCallback((challenge: Challenge) => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current
    if (!video || !landmarker) return

    const tick = () => {
      if (video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now())
        if (detectChallenge(result, challenge)) {
          stabilityCounterRef.current += 1
          
          if (stabilityCounterRef.current >= requiredStability(challenge)) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = 0
            setPassed(true)
            return
          }
        } else {
          // Reset if they stop doing the challenge
          stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 1)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { videoRef, currentChallenge, passed, loading, error, start, stop }
}
