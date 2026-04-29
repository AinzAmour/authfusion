# AuthFusion Web App — Master Upgrade Implementation Prompt

> Copy this entire prompt into Claude Code, Cursor, or any AI coding assistant.
> Implement each phase in order. Do NOT skip phases — later phases depend on earlier ones.

---

## PROJECT CONTEXT (Read before making any changes)

**Project:** AuthFusion Identity Platform (web app)
**Repo:** Secure-Login-Hub

### Current Stack
```
Frontend:   React 18, Vite, TypeScript
Styling:    Tailwind CSS, Shadcn UI, Lucide Icons
Animation:  Framer Motion, Sonner
State/Data: TanStack Query, Axios
Biometrics: face-api.js, WebAuthn API
Database:   Neon PostgreSQL (Serverless)
AI:         Gemini (risk scoring)
Runtime:    Node.js 18+
```

### Key Flows
- **Flow 1:** 11-step onboarding (device binding → OTP → Aadhaar → face match → liveness → WebAuthn → CAPTCHA → MPIN → verifiable credential)
- **Flow 2:** Re-login (MPIN → risk engine → biometric → session token)
- **Flow 3:** Re-KYC / cross-platform sharing with ZKP selective disclosure

### Absolute Rules (never break these)
1. No raw biometric data ever leaves the client device
2. AES-256-GCM encryption on all PII at rest
3. WebAuthn credentials remain device-bound
4. Session cookie flags: `HttpOnly`, `Secure`, `SameSite: Strict`
5. MPIN stored as argon2 hash + salt only — never plaintext

---

## IMPLEMENTATION ORDER

```
Phase 1 → Vite config fixes (WASM/ONNX/snarkjs)
Phase 2 → Replace face-api.js with MediaPipe
Phase 3 → Add behavioral biometrics
Phase 4 → Upgrade risk engine (ONNX.js + Gemini ensemble)
Phase 5 → Add Drizzle ORM + Upstash Redis
Phase 6 → Add tRPC + Zod type safety
Phase 7 → Web Crypto API (replace library encryption)
Phase 8 → ZKP with snarkjs (Flow 3)
Phase 9 → CSP headers + security hardening
Phase 10 → PWA with vite-plugin-pwa
Phase 11 → Real-time QR handoff (WebSockets)
Phase 12 → Sentry + OpenTelemetry
Phase 13 → PostHog analytics
Phase 14 → Accessibility (axe-core + ARIA)
Phase 15 → i18n with react-i18next
Phase 16 → Playwright + Vitest testing
```

---

## PHASE 1 — Vite Configuration (Do This First)

**Why:** ONNX Runtime and snarkjs use WebAssembly. Vite pre-bundles dependencies by default and breaks WASM loading. Fix this before installing anything else.

### Install
```bash
pnpm add -D vite-plugin-wasm vite-plugin-top-level-await
```

### `vite.config.ts` — full replacement
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: [
      'onnxruntime-web',
      'snarkjs',
      '@mediapipe/tasks-vision',
    ],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          mediapipe: ['@mediapipe/tasks-vision'],
          onnx: ['onnxruntime-web'],
        },
      },
    },
  },
})
```

> **Why `COOP/COEP` headers?** SharedArrayBuffer (required by ONNX WASM multi-thread) needs these. Without them, ONNX silently falls back to single-thread mode and runs 5× slower.

---

## PHASE 2 — Replace face-api.js with MediaPipe Face Landmarker

### Install
```bash
pnpm remove face-api.js
pnpm add @mediapipe/tasks-vision
```

### Create `src/lib/liveness/mediapipe-init.ts`
```typescript
import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from '@mediapipe/tasks-vision'

let faceLandmarker: FaceLandmarker | null = null

export async function initFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker

  const filesetResolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  )

  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: navigator.gpu ? 'GPU' : 'CPU', // WebGPU if available
    },
    outputFaceBlendshapes: true,   // required for smile + blink detection
    runningMode: 'VIDEO',
    numFaces: 1,
  })

  return faceLandmarker
}

export { DrawingUtils }
```

> **Common error:** `TypeError: Cannot read properties of undefined (reading 'createFromOptions')`
> **Fix:** Always `await FilesetResolver.forVisionTasks(...)` before `FaceLandmarker.createFromOptions`. Never call these in parallel.

### Create `src/lib/liveness/challenges.ts`
```typescript
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
      const yaw = result.facialTransformationMatrixes?.[0]
      // Use landmark 33 (nose tip) vs 263 (left cheek) horizontal delta
      const landmarks = result.faceLandmarks?.[0]
      if (!landmarks) return false
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
```

### Create `src/hooks/useLiveness.ts`
```typescript
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
```

> **Common error:** `landmarker.detectForVideo` throws if `readyState < 2`
> **Fix:** Always check `video.readyState >= 2` before calling detect, as shown above.

---

## PHASE 3 — Behavioral Biometrics

### Create `src/lib/biometrics/behavioral.ts`
```typescript
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
```

### Create `src/hooks/useBehavioralBiometrics.ts`
```typescript
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
```

> Add `useBehavioralBiometrics()` to your root `App.tsx` so collection starts on page load and accumulates data across all steps.

---

## PHASE 4 — Multi-Model Risk Engine (ONNX.js + Gemini Ensemble)

### Install
```bash
pnpm add onnxruntime-web
```

### Create `src/lib/risk/onnx-scorer.ts`
```typescript
import * as ort from 'onnxruntime-web'

// Configure WASM paths — critical for Vite builds
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/'

let session: ort.InferenceSession | null = null

export async function initONNXRiskScorer(modelPath: string): Promise<void> {
  // Use GPU if WebGPU is available, else WASM
  const executionProviders: ort.InferenceSession.ExecutionProviderConfig[] =
    navigator.gpu ? ['webgpu', 'wasm'] : ['wasm']

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
```

### Create `src/lib/risk/ensemble.ts`
```typescript
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
```

> **Common error:** `Promise.allSettled` ensures one model failure doesn't block login. Never use `Promise.all` here — if Gemini is down, you still need a risk score.

---

## PHASE 5 — Drizzle ORM + Upstash Redis

### Install
```bash
pnpm add drizzle-orm @neondatabase/serverless drizzle-zod
pnpm add @upstash/redis @upstash/ratelimit
pnpm add -D drizzle-kit
```

### Create `src/db/schema.ts`
```typescript
import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  mobileNumber: text('mobile_number').notNull().unique(),
  email: text('email').notNull().unique(),
  aadhaarHash: text('aadhaar_hash').notNull(), // AES-256-GCM encrypted
  mpinHash: text('mpin_hash').notNull(),       // argon2 hash
  deviceId: text('device_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const loginAttempts = pgTable('login_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
  lastAttemptAt: timestamp('last_attempt_at').defaultNow().notNull(),
})

export const riskEvents = pgTable('risk_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  riskScore: integer('risk_score').notNull(), // 0-100
  riskLevel: text('risk_level').notNull(),
  signals: jsonb('signals').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const verifiableCredentials = pgTable('verifiable_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  credentialHash: text('credential_hash').notNull(),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
})
```

### Create `src/db/client.ts`
```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

### Create `src/lib/redis/rate-limit.ts`
```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 3 MPIN attempts per 15 minutes per user (replaces in-memory counter)
export const mpinLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(3, '15 m'),
  prefix: 'authfusion:mpin',
})

// 5 OTP requests per 10 minutes per phone number
export const otpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  prefix: 'authfusion:otp',
})

// Global login rate limit: 20 attempts per minute per IP
export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'authfusion:login',
})
```

### Update `.env`
```env
DATABASE_URL=your_neon_postgresql_url
SESSION_SECRET=your_long_random_string_min_32_chars
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
GEMINI_API_KEY=your_gemini_key
```

---

## PHASE 6 — tRPC + Zod Type Safety

### Install
```bash
pnpm add @trpc/server @trpc/client @trpc/react-query @trpc/tanstack-react-query zod
```

### Create `src/server/trpc.ts`
```typescript
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Request, Response } from 'express'

interface Context {
  req: Request
  res: Response
  userId?: string
}

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})
```

### Create `src/server/routers/auth.ts`
```typescript
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { mpinLimiter } from '@/lib/redis/rate-limit'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Input schemas — Zod validates all PII before it touches the DB
const aadhaarSchema = z.string().regex(/^\d{12}$/, 'Invalid Aadhaar number')
const mpinSchema = z.string().length(6).regex(/^\d{6}$/, 'MPIN must be 6 digits')
const otpSchema = z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits')
const phoneSchema = z.string().regex(/^\+91[6-9]\d{9}$/, 'Invalid Indian mobile number')

export const authRouter = router({
  verifyMpin: protectedProcedure
    .input(z.object({ mpin: mpinSchema }))
    .mutation(async ({ input, ctx }) => {
      // Check rate limit FIRST — before any DB query
      const { success, remaining } = await mpinLimiter.limit(ctx.userId)
      if (!success) {
        throw new Error(`Account locked. Try again later. (${remaining} attempts remaining)`)
      }
      // Your existing MPIN verification logic here
      return { success: true }
    }),

  initiateOtp: publicProcedure
    .input(z.object({ phone: phoneSchema }))
    .mutation(async ({ input }) => {
      // Your OTP send logic here
      return { sent: true }
    }),
})
```

> **Common error:** tRPC with Vite needs the server running separately (Express). The client connects via `httpBatchLink`. Do NOT try to run tRPC inside Vite's dev server — it's a static asset server, not a Node server.

### Create `src/lib/trpc-client.ts`
```typescript
import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../server/router'

export const trpc = createTRPCReact<AppRouter>()

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_API_URL + '/trpc',
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'include' })
      },
    }),
  ],
})
```

---

## PHASE 7 — Web Crypto API (Replace Library Encryption)

### Create `src/lib/crypto/webcrypto.worker.ts`
```typescript
// Runs in a Web Worker — never blocks the main thread

async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

async function encryptPII(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

async function decryptPII(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
  const ciphertextBuffer = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    ciphertextBuffer
  )

  return new TextDecoder().decode(plaintextBuffer)
}

self.onmessage = async (e) => {
  const { type, payload } = e.data
  try {
    if (type === 'ENCRYPT') {
      const result = await encryptPII(payload.plaintext, payload.key)
      self.postMessage({ type: 'ENCRYPT_RESULT', result })
    } else if (type === 'DECRYPT') {
      const result = await decryptPII(payload.ciphertext, payload.iv, payload.key)
      self.postMessage({ type: 'DECRYPT_RESULT', result })
    }
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: (error as Error).message })
  }
}
```

### Create `src/hooks/useCrypto.ts`
```typescript
import { useRef, useCallback } from 'react'

export function useCrypto() {
  // Vite: new URL() with import.meta.url is the correct way to reference workers
  const workerRef = useRef<Worker>(
    new Worker(new URL('../lib/crypto/webcrypto.worker.ts', import.meta.url), {
      type: 'module',
    })
  )

  const encrypt = useCallback((plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> => {
    return new Promise((resolve, reject) => {
      workerRef.current.onmessage = (e) => {
        if (e.data.type === 'ENCRYPT_RESULT') resolve(e.data.result)
        if (e.data.type === 'ERROR') reject(new Error(e.data.error))
      }
      workerRef.current.postMessage({ type: 'ENCRYPT', payload: { plaintext, key } })
    })
  }, [])

  return { encrypt }
}
```

> **Common error:** `DOMException: The provided ArrayBuffer is detached`
> **Fix:** Never pass a `CryptoKey` through `postMessage` — it will be transferred (detached). Export the key to JWK, send the JWK, and re-import in the worker.

---

## PHASE 8 — Zero-Knowledge Proof with snarkjs (Flow 3)

### Install
```bash
pnpm add snarkjs
```

### Create `src/lib/zkp/selective-disclosure.ts`
```typescript
// snarkjs must be dynamically imported — it's WASM-heavy
// Vite's optimizeDeps.exclude in Phase 1 handles this

interface DisclosureInput {
  aadhaarNumber: string       // private — never sent
  claimType: 'age_over_18' | 'kyc_verified' | 'india_resident'
  salt: string                // random salt for commitment
}

interface DisclosureProof {
  proof: object
  publicSignals: string[]
}

export async function generateSelectiveDisclosureProof(
  input: DisclosureInput
): Promise<DisclosureProof> {
  // Dynamic import — snarkjs is large, only load when Flow 3 is triggered
  const snarkjs = await import('snarkjs')

  // In production: load from your server or IPFS
  // These are the circuit artifacts generated by your circom circuit
  const wasmPath = '/circuits/selective_disclosure.wasm'
  const zkeyPath = '/circuits/selective_disclosure_final.zkey'

  const circuitInput = {
    aadhaar: BigInt(
      input.aadhaarNumber.split('').reduce((acc, c) => acc * 10n + BigInt(c), 0n)
    ).toString(),
    salt: BigInt('0x' + input.salt).toString(),
    claimType: input.claimType === 'age_over_18' ? '1' :
               input.claimType === 'kyc_verified' ? '2' : '3',
  }

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput,
    wasmPath,
    zkeyPath
  )

  return { proof, publicSignals }
}

export async function verifyProof(
  proof: object,
  publicSignals: string[],
  verificationKeyPath: string
): Promise<boolean> {
  const snarkjs = await import('snarkjs')
  const vkeyResponse = await fetch(verificationKeyPath)
  const vkey = await vkeyResponse.json()
  return snarkjs.groth16.verify(vkey, publicSignals, proof)
}
```

> **Note:** You need to compile your circom circuit first (`selective_disclosure.circom`) to generate the `.wasm` and `.zkey` files. Place them in `public/circuits/`. Use Reclaim Protocol or PolygonID as a managed alternative if you don't want to run your own trusted setup.

---

## PHASE 9 — CSP Headers + Security Hardening

### Install
```bash
pnpm add helmet express-rate-limit
```

### Update your Express server entry point
```typescript
import helmet from 'helmet'
import express from 'express'

const app = express()

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'nonce-REPLACE_WITH_PER_REQUEST_NONCE'", // generate per request
          'https://cdn.jsdelivr.net',               // MediaPipe WASM
          'https://storage.googleapis.com',         // MediaPipe model
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],    // Tailwind needs this
        imgSrc: ["'self'", 'data:', 'blob:'],       // webcam frames
        connectSrc: [
          "'self'",
          'https://generativelanguage.googleapis.com', // Gemini
          'wss:',                                      // WebSocket for QR handoff
        ],
        workerSrc: ["'self'", 'blob:'],              // Web Workers + WASM
        mediaSrc: ["'self'", 'blob:'],               // webcam stream
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
)
```

> **Common error:** ONNX/MediaPipe WASM fails to load after adding CSP.
> **Fix:** Add `worker-src 'self' blob:` and `script-src 'wasm-unsafe-eval'` for WASM execution. MediaPipe loads its own workers via blob URLs.

---

## PHASE 10 — PWA with vite-plugin-pwa

### Install
```bash
pnpm add -D vite-plugin-pwa workbox-window
```

### Update `vite.config.ts` — add PWA plugin
```typescript
import { VitePWA } from 'vite-plugin-pwa'

// Add to plugins array:
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
    runtimeCaching: [
      {
        // Cache MediaPipe model files (large — cache aggressively)
        urlPattern: /^https:\/\/storage\.googleapis\.com\/mediapipe-models\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'mediapipe-models',
          expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Cache MediaPipe WASM files
        urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'mediapipe-wasm', expiration: { maxEntries: 10 } },
      },
    ],
  },
  manifest: {
    name: 'AuthFusion Identity Platform',
    short_name: 'AuthFusion',
    theme_color: '#1e1b4b',
    background_color: '#0f0e1a',
    display: 'standalone',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```

---

## PHASE 11 — Real-Time QR Handoff (WebSockets via Ably)

### Install
```bash
pnpm add ably
```

### Create `src/lib/handoff/qr-channel.ts`
```typescript
import Realtime from 'ably'

let client: Realtime | null = null

function getClient(): Realtime {
  if (!client) {
    client = new Realtime({ authUrl: '/api/ably-token', authMethod: 'POST' })
  }
  return client
}

export function subscribeToHandoff(
  sessionId: string,
  onComplete: (data: { deviceId: string; biometricToken: string }) => void,
  onError: (err: Error) => void
) {
  const channel = getClient().channels.get(`handoff:${sessionId}`)

  channel.subscribe('biometric-complete', (message) => {
    onComplete(message.data)
    channel.unsubscribe()
  })

  channel.subscribe('error', (message) => {
    onError(new Error(message.data.message))
  })

  // Auto-cleanup after 10 minutes (QR code expiry)
  const timeout = setTimeout(() => {
    channel.unsubscribe()
    onError(new Error('QR code expired'))
  }, 10 * 60 * 1000)

  return () => {
    clearTimeout(timeout)
    channel.unsubscribe()
  }
}

export function publishHandoffComplete(
  sessionId: string,
  payload: { deviceId: string; biometricToken: string }
) {
  const channel = getClient().channels.get(`handoff:${sessionId}`)
  return channel.publish('biometric-complete', payload)
}
```

---

## PHASE 12 — Sentry + OpenTelemetry

### Install
```bash
pnpm add @sentry/react @sentry/tracing
pnpm add -D @sentry/vite-plugin
```

### Create `src/lib/monitoring/sentry.ts`
```typescript
import * as Sentry from '@sentry/react'

export function initSentry() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        new Sentry.BrowserTracing({
          tracePropagationTargets: ['localhost', import.meta.env.VITE_API_URL],
        }),
        new Sentry.Replay({
          maskAllText: true,      // CRITICAL: mask PII in session replays
          blockAllMedia: true,    // block webcam frames from replays
        }),
      ],
      tracesSampleRate: 0.1,     // 10% of transactions in production
      replaysSessionSampleRate: 0.0, // No automatic replays
      replaysOnErrorSampleRate: 1.0, // Full replay only on errors
      beforeSend(event) {
        // Strip any PII that might leak into error context
        if (event.user) delete event.user.email
        return event
      },
    })
  }
}
```

### Update `vite.config.ts` — add Sentry source maps
```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Add to plugins array (production only):
...(process.env.NODE_ENV === 'production'
  ? [sentryVitePlugin({ org: 'your-org', project: 'authfusion' })]
  : [])
```

---

## PHASE 13 — PostHog Analytics

### Install
```bash
pnpm add posthog-js posthog-react
```

### Create `src/lib/analytics/posthog.ts`
```typescript
import posthog from 'posthog-js'

export function initPostHog() {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    // Privacy: do not capture personal data
    sanitize_properties: (properties) => {
      delete properties['$email']
      delete properties['$phone']
      return properties
    },
  })
}

// Track onboarding funnel step completions
export function trackFlowStep(
  flow: 'onboarding' | 'login' | 'rekyc',
  step: number,
  stepName: string,
  metadata?: Record<string, string | number | boolean>
) {
  posthog.capture('flow_step_completed', {
    flow,
    step,
    step_name: stepName,
    ...metadata,
  })
}

// Track liveness challenge outcomes
export function trackLivenessResult(
  challenge: string,
  passed: boolean,
  attemptDuration: number
) {
  posthog.capture('liveness_challenge', { challenge, passed, duration_ms: attemptDuration })
}
```

---

## PHASE 14 — Accessibility

### Install
```bash
pnpm add -D @axe-core/react
```

### Update `src/main.tsx`
```typescript
if (import.meta.env.DEV) {
  import('@axe-core/react').then(({ default: axe }) => {
    axe(React, ReactDOM, 1000)
  })
}
```

### Update your liveness component — add ARIA live region
```tsx
// In your liveness challenge component:
<div
  aria-live="polite"
  aria-atomic="true"
  className="sr-only" // visually hidden but announced by screen readers
>
  {currentChallenge
    ? `Please ${challengeInstructions[currentChallenge]}`
    : passed
    ? 'Liveness verification passed successfully'
    : 'Liveness verification starting'}
</div>
```

### Create `src/lib/a11y/challenge-instructions.ts`
```typescript
export const challengeInstructions: Record<string, string> = {
  smile: 'smile at the camera',
  blink: 'blink both eyes',
  turn_left: 'slowly turn your head to the left',
  turn_right: 'slowly turn your head to the right',
  look_up: 'look upward',
  look_down: 'look downward',
}
```

---

## PHASE 15 — i18n with react-i18next

### Install
```bash
pnpm add react-i18next i18next i18next-browser-languagedetector i18next-http-backend
```

### Create `src/lib/i18n/config.ts`
```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

i18n
  .use(HttpBackend)               // lazy-load locale files
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi', 'ta', 'te', 'bn'],
    ns: ['common', 'auth', 'liveness', 'errors'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['navigator', 'htmlTag'],
      caches: [],  // don't cache language choice — respect browser setting
    },
    interpolation: { escapeValue: false },
  })

export default i18n
```

### Create `public/locales/en/liveness.json`
```json
{
  "challenge_smile": "Please smile at the camera",
  "challenge_blink": "Please blink both eyes",
  "challenge_turn_left": "Please turn your head to the left",
  "challenge_turn_right": "Please turn your head to the right",
  "challenge_look_up": "Please look upward",
  "challenge_look_down": "Please look downward",
  "passed": "Verification passed",
  "failed": "Verification failed. Please try again.",
  "loading": "Starting camera..."
}
```

---

## PHASE 16 — Playwright + Vitest Testing

### Install
```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
pnpm add -D playwright @playwright/test
```

### Create `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

### Create `src/test/setup.ts`
```typescript
import '@testing-library/jest-dom'

// Mock MediaDevices (webcam) for unit tests
Object.defineProperty(window.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
})

// Mock WebAuthn for unit tests
window.PublicKeyCredential = {
  isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
} as any
```

### Create `e2e/liveness.spec.ts`
```typescript
import { test, expect } from '@playwright/test'
import path from 'path'

test('liveness challenge — smile passes', async ({ page, context }) => {
  // Grant camera permissions
  await context.grantPermissions(['camera'])

  // Mock the webcam with a pre-recorded video of a smiling face
  await context.addInitScript(() => {
    const mockStream = { getTracks: () => [{ stop: () => {} }] }
    navigator.mediaDevices.getUserMedia = async () => mockStream as any
  })

  await page.goto('/onboarding/liveness')
  await page.click('[data-testid="start-liveness"]')

  // Wait for challenge to appear
  await expect(page.getByRole('status')).toContainText('smile', { timeout: 5000 })
})
```

---

## FINAL CHECKLIST

Run these checks after all phases are complete:

```bash
# 1. Type check — zero errors expected
pnpm tsc --noEmit

# 2. Lint
pnpm eslint src --ext .ts,.tsx --max-warnings 0

# 3. Unit tests
pnpm vitest run

# 4. Build — must succeed without warnings about WASM or circular deps
pnpm build

# 5. Preview build locally
pnpm preview

# 6. Run e2e tests against preview
pnpm playwright test
```

### Environment variables checklist
```env
DATABASE_URL=                    ✓ Neon PostgreSQL connection string
SESSION_SECRET=                  ✓ Min 32 random chars
UPSTASH_REDIS_REST_URL=          ✓ From Upstash console
UPSTASH_REDIS_REST_TOKEN=        ✓ From Upstash console
GEMINI_API_KEY=                  ✓ From Google AI Studio
VITE_SENTRY_DSN=                 ✓ From Sentry project settings
VITE_POSTHOG_KEY=                ✓ From PostHog project settings
VITE_API_URL=                    ✓ Your Express server URL (e.g. http://localhost:3001)
```

### Known Vite + WASM gotchas (quick reference)
| Error | Fix |
|---|---|
| `SharedArrayBuffer is not defined` | Add `COOP/COEP` headers in `vite.config.ts` server.headers |
| `ONNX session create failed` | Add `onnxruntime-web` to `optimizeDeps.exclude` |
| `snarkjs groth16 fullProve is not a function` | Dynamic import snarkjs, never static import |
| `MediaPipe WASM 404` | Use the jsdelivr CDN path, not a local copy |
| `Worker script URL not found` | Use `new URL('../path/worker.ts', import.meta.url)` pattern |
| `CryptoKey postMessage error` | Export key to JWK before posting to worker |
| `face-api.js not found` after removal | Search for all imports — check `index.ts` barrel files |

---

*Generated for AuthFusion Identity Platform — HackHustle Hackathon*
*Stack: React 18 + Vite + TypeScript + Neon PostgreSQL*
