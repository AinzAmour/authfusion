import { useEffect } from 'react'
import { behavioralCollector } from '@/lib/biometrics/behavioral'

export function useBehavioralBiometrics() {
  useEffect(() => {
    window.addEventListener('keydown', behavioralCollector.onKeyDown)
    window.addEventListener('mousemove', behavioralCollector.onMouseMove)
    window.addEventListener('touchstart', behavioralCollector.onTouchStart)
    window.addEventListener('scroll', behavioralCollector.onScroll, { passive: true })

    return () => {
      window.removeEventListener('keydown', behavioralCollector.onKeyDown)
      window.removeEventListener('mousemove', behavioralCollector.onMouseMove)
      window.removeEventListener('touchstart', behavioralCollector.onTouchStart)
      window.removeEventListener('scroll', behavioralCollector.onScroll)
    }
  }, [])

  return { getProfile: () => behavioralCollector.getProfile() }
}
