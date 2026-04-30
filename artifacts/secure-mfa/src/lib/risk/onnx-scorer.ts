import * as ort from 'onnxruntime-web'

// Configure WASM paths — critical for Vite builds
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/'

let session: ort.InferenceSession | null = null

export async function initONNXRiskScorer(modelPath: string): Promise<void> {
  // Use GPU if WebGPU is available, else WASM
  const executionProviders: ort.InferenceSession.ExecutionProviderConfig[] =
    (navigator as any).gpu ? ['webgpu', 'wasm'] : ['wasm']

  session = await ort.InferenceSession.create(modelPath, {
    executionProviders,
    graphOptimizationLevel: 'all',
  })
}

export interface RiskFeatures {
  velocityScore: number       // login attempts per hour, normalized 0-1
  deviceScore: number         // device trust score 0-1
  behaviorScore: number       // behavioral biometric match 0-1
  geoAnomalyScore: number     // location anomaly 0-1
}

export async function getONNXRiskScore(features: RiskFeatures): Promise<number> {
  if (!session) throw new Error('ONNX session not initialized')

  const inputData = Float32Array.from([
    features.velocityScore,
    features.deviceScore,
    features.behaviorScore,
    features.geoAnomalyScore,
  ])

  const tensor = new ort.Tensor('float32', inputData, [1, 4])
  const results = await session.run({ input: tensor })
  const output = results['output']?.data as Float32Array

  if (!output || output.length === 0) throw new Error('ONNX model returned empty output')
  return Math.min(1, Math.max(0, output[0])) // clamp 0-1
}
