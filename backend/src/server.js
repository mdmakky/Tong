import http from 'http';
import { Server as SocketIO } from 'socket.io';
import app from './app.js';
import env from './config/env.js';
import { connectAllDatabases, disconnectAll } from './config/database.js';
import initializeSocket from './socket/index.js';

// ─── Create HTTP Server ────────────────────────
const server = http.createServer(app);

// ─── Initialize Socket.io ──────────────────────
const io = new SocketIO(server, {
  cors: {
    origin: env.ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// Attach io to app for access in routes if needed
app.set('io', io);

// Initialize socket handlers
initializeSocket(io);

// ─── Start Server ──────────────────────────────
const startServer = async () => {
  try {
    // Connect all databases
    await connectAllDatabases();

    // Start listening
    server.listen(env.PORT, () => {
      console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║   🚀 tong Backend Server                      ║
║                                              ║
║   Port:        ${String(env.PORT).padEnd(29)}║
║   Environment: ${String(env.NODE_ENV).padEnd(29)}║
║   API:         http://localhost:${String(env.PORT).padEnd(14)}║
║                                              ║
╚══════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

// ─── Graceful Shutdown ─────────────────────────
const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);

  // Close Socket.io
  io.close();

  // Close HTTP server
  server.close(async () => {
    await disconnectAll();
    console.log('👋 Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});

startServer();

export { io };
