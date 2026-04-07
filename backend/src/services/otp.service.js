import crypto from 'crypto';
import env from '../config/env.js';
import { getRedis } from '../config/database.js';

// In-memory fallback store when Redis is unavailable
const memoryStore = new Map();

/**
 * Generate OTP code (numeric)
 */
export const generateOTP = () => {
  const digits = env.OTP_LENGTH;
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return crypto.randomInt(min, max).toString();
};

/**
 * Store OTP in Redis (or memory fallback)
 * Key format: otp:{type}:{identifier}
 * @param {string} type - 'email_verify' | 'password_reset'
 * @param {string} identifier - email or userId
 * @param {string} otp - the OTP code
 */
export const storeOTP = async (type, identifier, otp) => {
  const key = `otp:${type}:${identifier}`;
  const ttl = env.OTP_EXPIRES_MINUTES * 60; // seconds

  const redis = getRedis();
  if (redis) {
    try {
      await redis.setex(key, ttl, otp);
      return;
    } catch (err) {
      console.warn('Redis OTP store failed, using memory fallback');
    }
  }

  // Memory fallback
  memoryStore.set(key, { otp, expiresAt: Date.now() + ttl * 1000 });
};

/**
 * Verify OTP
 * @returns {boolean} true if OTP matches and is not expired
 */
export const verifyOTP = async (type, identifier, otp) => {
  const key = `otp:${type}:${identifier}`;

  const redis = getRedis();
  if (redis) {
    try {
      const stored = await redis.get(key);
      if (stored && stored === otp) {
        await redis.del(key); // One-time use
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Redis OTP verify failed, trying memory fallback');
    }
  }

  // Memory fallback
  const entry = memoryStore.get(key);
  if (entry && entry.otp === otp && entry.expiresAt > Date.now()) {
    memoryStore.delete(key);
    return true;
  }
  return false;
};

/**
 * Delete OTP (cleanup)
 */
export const deleteOTP = async (type, identifier) => {
  const key = `otp:${type}:${identifier}`;

  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch (err) {
      // ignore
    }
  }
  memoryStore.delete(key);
};

// Periodic cleanup of expired memory entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt < now) memoryStore.delete(key);
  }
}, 60 * 1000);
