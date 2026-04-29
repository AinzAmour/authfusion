import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Fallback for development if not provided
  console.warn('Upstash Redis credentials missing. Rate limiting will be bypassed.')
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Sliding window rate limiter: 5 requests per 10 seconds
export const authRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 s'),
  analytics: true,
  prefix: 'authfusion:ratelimit',
})

export async function checkRateLimit(identifier: string) {
  if (!process.env.UPSTASH_REDIS_REST_URL) return { success: true }
  return await authRateLimiter.limit(identifier)
}
