import env from '../config/env.js';
import { prisma } from '../config/database.js';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

const parseBoolean = (value, defaultValue = true) => {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const runKeepAliveQuery = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`✅ Supabase keep-alive query successful at ${new Date().toISOString()}`);
  } catch (error) {
    console.warn('⚠️  Supabase keep-alive query failed:', error.message);
  }
};

export const startSupabaseKeepAlive = () => {
  const keepAliveEnabled = parseBoolean(env.SUPABASE_KEEPALIVE_ENABLED, true);

  if (!keepAliveEnabled) {
    console.log('ℹ️  Supabase keep-alive is disabled');
    return () => {};
  }

  const intervalHours = parsePositiveInt(env.SUPABASE_KEEPALIVE_INTERVAL_HOURS, 24);
  const intervalMs = intervalHours * 60 * 60 * 1000 || DEFAULT_INTERVAL_MS;

  // Trigger one ping on startup, then keep pinging on the configured interval.
  void runKeepAliveQuery();

  const timer = setInterval(() => {
    void runKeepAliveQuery();
  }, intervalMs);

  // Do not keep Node.js alive solely for this timer.
  timer.unref();

  console.log(`🫀 Supabase keep-alive scheduled every ${intervalHours} hour(s)`);

  return () => {
    clearInterval(timer);
    console.log('🛑 Supabase keep-alive stopped');
  };
};
