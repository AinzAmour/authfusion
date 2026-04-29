import { initTRPC, TRPCError } from '@trpc/server'
import { type CreateExpressContextOptions } from '@trpc/server/adapters/express'
import { getSession } from './lib/session'

export const createContext = ({ req, res }: CreateExpressContextOptions) => {
  const session = getSession(req)
  return { req, res, session }
}

type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.session.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      userId: ctx.session.userId,
    },
  })
})

export const protectedProcedure = t.procedure.use(isAuthed)
