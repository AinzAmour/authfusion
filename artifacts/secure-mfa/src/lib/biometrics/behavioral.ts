interface BehaviorProfile {
  avgKeystrokeInterval: number
  avgMouseVelocity: number
  touchPressureAvg: number
  scrollRhythm: number
  sampleCount: number
}

class BehavioralCollector {
  private keyTimestamps: number[] = []
  private mouseVelocities: number[] = []
  private lastMousePos = { x: 0, y: 0, t: 0 }
  private touchPressures: number[] = []
  private scrollTimestamps: number[] = []

  onKeyDown = () => {
    this.keyTimestamps.push(Date.now())
    if (this.keyTimestamps.length > 100) this.keyTimestamps.shift()
  }

  onMouseMove = (e: MouseEvent) => {
    const now = Date.now()
    const dt = now - this.lastMousePos.t
    if (dt > 0 && dt < 200) {
      const dx = e.clientX - this.lastMousePos.x
      const dy = e.clientY - this.lastMousePos.y
      const velocity = Math.sqrt(dx * dx + dy * dy) / dt
      this.mouseVelocities.push(velocity)
      if (this.mouseVelocities.length > 200) this.mouseVelocities.shift()
    }
    this.lastMousePos = { x: e.clientX, y: e.clientY, t: now }
  }

  onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    if ('force' in touch) {
      this.touchPressures.push((touch as any).force)
      if (this.touchPressures.length > 50) this.touchPressures.shift()
    }
  }

  onScroll = () => {
    this.scrollTimestamps.push(Date.now())
    if (this.scrollTimestamps.length > 50) this.scrollTimestamps.shift()
  }

  getProfile(): BehaviorProfile {
    const intervals = this.keyTimestamps
      .slice(1)
      .map((t, i) => t - this.keyTimestamps[i])
      .filter(d => d > 0 && d < 2000)

    const avgKeystrokeInterval =
      intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0

    const avgMouseVelocity =
      this.mouseVelocities.length > 0
        ? this.mouseVelocities.reduce((a, b) => a + b, 0) / this.mouseVelocities.length
        : 0

    const touchPressureAvg =
      this.touchPressures.length > 0
        ? this.touchPressures.reduce((a, b) => a + b, 0) / this.touchPressures.length
        : 0

    const scrollIntervals = this.scrollTimestamps
      .slice(1)
      .map((t, i) => t - this.scrollTimestamps[i])
    const scrollRhythm =
      scrollIntervals.length > 0
        ? scrollIntervals.reduce((a, b) => a + b, 0) / scrollIntervals.length
        : 0

    return {
      avgKeystrokeInterval,
      avgMouseVelocity,
      touchPressureAvg,
      scrollRhythm,
      sampleCount: this.keyTimestamps.length + this.mouseVelocities.length,
    }
  }
}

export const behavioralCollector = new BehavioralCollector()
