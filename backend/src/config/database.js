import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import env from './env.js';

const shouldFailOnDbError = env.NODE_ENV === 'production';

const handleDbConnectionError = (label, err) => {
  console.error(`❌ ${label} connection error:`, err.message);

  if (shouldFailOnDbError) {
    process.exit(1);
  }

  console.warn(`⚠️  Continuing startup without ${label} (development mode)`);
};

// ─── Prisma (PostgreSQL) ───────────────────────
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// ─── MongoDB ───────────────────────────────────
export const connectMongoDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ MongoDB connected');
    return true;
  } catch (err) {
    handleDbConnectionError('MongoDB', err);
    return false;
  }
};

// ─── Redis ─────────────────────────────────────
let redis = null;
let redisFallbackAttempted = false;

const buildRedisClient = (useTls) => {
  const redisUrl = useTls ? env.REDIS_URL : env.REDIS_URL.replace(/^rediss:\/\//, 'redis://');

  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) {
        console.warn('⚠️  Redis retry limit reached — continuing without Redis');
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    tls: useTls ? { rejectUnauthorized: false } : undefined,
  });
};

export const connectRedis = () => {
  if (!env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not set — running without Redis (cache/presence disabled)');
    return null;
  }

  try {
    const startedWithTls = env.REDIS_URL.startsWith('rediss://');
    redis = buildRedisClient(startedWithTls);

    redis.on('connect', () => console.log('✅ Redis connected'));
    redis.on('error', (err) => {
      const isTlsVersionError = /wrong version number/i.test(err.message);

      if (startedWithTls && isTlsVersionError && !redisFallbackAttempted) {
        redisFallbackAttempted = true;
        console.warn('⚠️  Redis TLS handshake failed — retrying without TLS');

        if (redis) {
          redis.disconnect();
        }

        redis = buildRedisClient(false);
        redis.on('connect', () => console.log('✅ Redis connected (non-TLS fallback)'));
        redis.on('error', (fallbackErr) => {
          console.warn('⚠️  Redis error:', fallbackErr.message);
        });
        return;
      }

      console.warn('⚠️  Redis error:', err.message);
    });

    return redis;
  } catch (err) {
    console.warn('⚠️  Redis init failed:', err.message, '— continuing without Redis');
    return null;
  }
};

export const getRedis = () => redis;

// ─── Connect All ───────────────────────────────
export const connectAllDatabases = async () => {
  // PostgreSQL (Prisma connects lazily, but let's test)
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected (Prisma)');
  } catch (err) {
    handleDbConnectionError('PostgreSQL', err);
  }

  // MongoDB
  await connectMongoDB();

  // Redis (optional — won't crash if unavailable)
  connectRedis();
};

// ─── Graceful Disconnect ───────────────────────
export const disconnectAll = async () => {
  await prisma.$disconnect();
  await mongoose.disconnect();
  if (redis) redis.disconnect();
  console.log('🔌 All databases disconnected');
};
