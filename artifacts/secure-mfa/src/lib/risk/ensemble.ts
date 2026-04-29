import { getONNXRiskScore, type RiskFeatures } from './onnx-scorer'

interface GeminiRiskContext {
  userAgent: string
  loginHour: number
  countryCode: string
  previousFailures: number
  behaviorProfile: Record<string, number>
}

async function getGeminiContextScore(context: GeminiRiskContext): Promise<number> {
  const response = await fetch('/api/risk/gemini-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context),
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Gemini risk API failed')
  const data = await response.json()
  return data.score as number // 0-1
}

export async function getEnsembleRiskScore(
  features: RiskFeatures,
  context: GeminiRiskContext
): Promise<{ score: number; level: 'low' | 'medium' | 'high'; requiresStepUp: boolean }> {
  // Run both in parallel for speed
  const [onnxScore, geminiScore] = await Promise.allSettled([
    getONNXRiskScore(features),
    getGeminiContextScore(context),
  ])

  const o = onnxScore.status === 'fulfilled' ? onnxScore.value : 0.5 // fallback
  const g = geminiScore.status === 'fulfilled' ? geminiScore.value : 0.5

  // Weighted ensemble: ONNX (real-time signals) 60%, Gemini (context) 40%
  const score = o * 0.6 + g * 0.4

  return {
    score,
    level: score < 0.3 ? 'low' : score < 0.7 ? 'medium' : 'high',
    requiresStepUp: score >= 0.7,
  }
}
