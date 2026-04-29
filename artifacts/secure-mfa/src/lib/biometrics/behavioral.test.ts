import { describe, it, expect, beforeEach, vi } from 'vitest'
import { behavioralCollector } from './behavioral'

describe('BehavioralCollector', () => {
  beforeEach(() => {
    // Reset internal state if possible or use a fresh instance
    // For singleton, we just mock the timestamps
    vi.useFakeTimers()
  })

  it('should calculate keystroke intervals correctly', () => {
    behavioralCollector.onKeyDown()
    vi.advanceTimersByTime(100)
    behavioralCollector.onKeyDown()
    vi.advanceTimersByTime(150)
    behavioralCollector.onKeyDown()

    const profile = behavioralCollector.getProfile()
    expect(profile.avgKeystrokeInterval).toBeGreaterThan(100)
    expect(profile.avgKeystrokeInterval).toBeLessThan(150)
  })

  it('should track mouse velocity', () => {
    const e1 = { clientX: 0, clientY: 0 } as MouseEvent
    const e2 = { clientX: 100, clientY: 100 } as MouseEvent
    
    behavioralCollector.onMouseMove(e1)
    vi.advanceTimersByTime(10)
    behavioralCollector.onMouseMove(e2)

    const profile = behavioralCollector.getProfile()
    expect(profile.avgMouseVelocity).toBeGreaterThan(0)
  })
})
