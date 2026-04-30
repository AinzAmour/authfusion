import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'

export type Challenge = 'smile' | 'blink' | 'turn_left' | 'turn_right' | 'look_up' | 'look_down'

interface BlendShape {
  categoryName: string
  score: number
}

function getBlendShape(result: FaceLandmarkerResult, name: string): number {
  const shapes = result.faceBlendshapes?.[0]?.categories ?? []
  return shapes.find((s: BlendShape) => s.categoryName === name)?.score ?? 0
}

export function detectChallenge(
  result: FaceLandmarkerResult,
  challenge: Challenge
): boolean {
  if (!result.faceBlendshapes?.length) return false

  switch (challenge) {
    case 'smile': {
      const smileLeft = getBlendShape(result, 'mouthSmileLeft')
      const smileRight = getBlendShape(result, 'mouthSmileRight')
      return smileLeft > 0.6 && smileRight > 0.6
    }

    case 'blink': {
      const blinkLeft = getBlendShape(result, 'eyeBlinkLeft')
      const blinkRight = getBlendShape(result, 'eyeBlinkRight')
      const threshold = 0.55
      return blinkLeft > threshold && blinkRight > threshold
    }

    case 'turn_left': {
      const landmarks = result.faceLandmarks?.[0]
      if (!landmarks) return false
      // Use landmark 33 (nose tip) vs 263 (left cheek) horizontal delta
      const delta = landmarks[33].x - landmarks[263].x
      return delta > 0.08
    }

    case 'turn_right': {
      const landmarks = result.faceLandmarks?.[0]
      if (!landmarks) return false
      const delta = landmarks[263].x - landmarks[33].x
      return delta > 0.08
    }

    case 'look_up': {
      const landmarks = result.faceLandmarks?.[0]
      if (!landmarks) return false
      const delta = landmarks[10].y - landmarks[152].y
      return delta < -0.2
    }

    case 'look_down': {
      const landmarks = result.faceLandmarks?.[0]
      if (!landmarks) return false
      const delta = landmarks[152].y - landmarks[10].y
      return delta > 0.2
    }

    default:
      return false
  }
}
