import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { getRedis } from '../config/database.js';

/**
 * Generate JWT access token
 */
export const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

/**
 * Generate JWT refresh token
 */
export const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
};

/**
 * Generate both tokens
 */
export const generateTokenPair = (userId) => {
  return {
    accessToken: generateAccessToken(userId),
    refreshToken: generateRefreshToken(userId),
  };
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};

/**
 * Blacklist a token in Redis (on logout)
 * TTL = remaining time until token expires
 */
export const blacklistToken = async (token) => {
  const redis = getRedis();
  if (!redis) return; // Skip if Redis unavailable

  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return;

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.setex(`bl:${token}`, ttl, '1');
    }
  } catch (err) {
    console.warn('Token blacklist warning:', err.message);
  }
};

/**
 * Check if token is blacklisted
 */
export const isTokenBlacklisted = async (token) => {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const result = await redis.get(`bl:${token}`);
    return result === '1';
  } catch (err) {
    return false;
  }
};
