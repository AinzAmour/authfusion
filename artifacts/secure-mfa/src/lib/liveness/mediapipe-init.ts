import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from '@mediapipe/tasks-vision'

let faceLandmarker: FaceLandmarker | null = null

export async function initFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker

  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Biometric AI initialization timed out')), 10000)
  )

  try {
    const initPromise = (async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
      )

      faceLandmarker = (await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      })) as any as FaceLandmarker
      return faceLandmarker
    })()

    return await Promise.race([initPromise, timeoutPromise]) as FaceLandmarker
  } catch (error) {
    faceLandmarker = null
    throw error
  }
}

export { DrawingUtils }
