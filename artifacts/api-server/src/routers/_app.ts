import { router, publicProcedure } from '../trpc'
import { z } from 'zod'

export const appRouter = router({
  health: publicProcedure.query(() => 'ok'),
  // Sub-routers will be added here
})

export type AppRouter = typeof appRouter
