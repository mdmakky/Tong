import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import env from './env.js';

// ─── Prisma (PostgreSQL) ───────────────────────
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// ─── MongoDB ───────────────────────────────────
export const connectMongoDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// ─── Redis ─────────────────────────────────────
let redis = null;

export const connectRedis = () => {
  if (!env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not set — running without Redis (cache/presence disabled)');
    return null;
  }

  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('⚠️  Redis retry limit reached — continuing without Redis');
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });

    redis.on('connect', () => console.log('✅ Redis connected'));
    redis.on('error', (err) => {
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
    console.error('❌ PostgreSQL connection error:', err.message);
    process.exit(1);
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
