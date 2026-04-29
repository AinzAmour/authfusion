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
    case 'smile':
      return getBlendShape(result, 'mouthSmileLeft') > 0.6 &&
             getBlendShape(result, 'mouthSmileRight') > 0.6

    case 'blink':
      return getBlendShape(result, 'eyeBlinkLeft') > 0.7 &&
             getBlendShape(result, 'eyeBlinkRight') > 0.7

    case 'turn_left': {
      const landmarks = result.faceLandmarks?.[0]
      if (!landmarks) return false
      // Use landmark 33 (nose tip) vs 263 (left cheek) horizontal delta
      return (landmarks[33].x - landmarks[263].x) > 0.08
    }

    case 'turn_right': {
      const landmarks = result.faceLandmarks?.[0]
      if (!landmarks) return false
      return (landmarks[263].x - landmarks[33].x) > 0.08
    }

    case 'look_up': {
      const landmarks = result.faceLandmarks?.[0]
      if (!landmarks) return false
      return (landmarks[10].y - landmarks[152].y) < -0.2
    }

    case 'look_down': {
      const landmarks = result.faceLandmarks?.[0]
      if (!landmarks) return false
      return (landmarks[152].y - landmarks[10].y) > 0.2
    }

    default:
      return false
  }
}
