import express, { type Express } from "express";
import "dotenv/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load from current dir and root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import cors from "cors";
import pinoHttp from "pino-http";
import cookieSession from "cookie-session";
import router from "./routes";
import { logger } from "./lib/logger";

import helmet from "helmet";
import { checkRateLimit } from "./lib/redis/rate-limit";

const app: Express = express();

// Security Hardening
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP in dev to avoid blocking MediaPipe/ONNX
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginEmbedderPolicy: false, // Required for SharedArrayBuffer in some environments
}));
app.use(cors({ 
  origin: process.env.CLIENT_URL || true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Global Rate Limit Middleware for Auth
app.use('/api/auth', async (req, res, next) => {
  const identifier = req.ip || 'anonymous';
  const result = await checkRateLimit(identifier);
  if (!result.success) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const sessionSecret =
  process.env["SESSION_SECRET"] ?? "dev-only-session-secret-change-me";

app.use(
  cookieSession({
    name: "authfusion.sid",
    keys: [sessionSecret],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
  }),
);

// Session Debug Logging
app.use((req, res, next) => {
  const session = (req as any).session;
  logger.info({ 
    path: req.path, 
    hasSession: !!session, 
    userId: session?.userId,
    cookies: req.headers.cookie ? 'present' : 'absent'
  }, "Session Debug");
  next();
});

import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './routers/_app';
import { createContext } from './trpc';

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.use("/api", router);

export default app;
