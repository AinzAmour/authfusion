import app from "./app";
import { logger } from "./lib/logger";
import { createServer } from "http";
import { Server } from "socket.io";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  }
});

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "WebSocket connected");

  socket.on("join-handoff", (sessionId: string) => {
    socket.join(`handoff:${sessionId}`);
    logger.info({ sessionId, socketId: socket.id }, "Joined handoff room");
  });

  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "WebSocket disconnected");
  });
});

// Export io to be used in routes
export { io };

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening (with WebSockets)");
});
