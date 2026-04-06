import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { prisma } from '../config/database.js';
import { getRedis } from '../config/database.js';
import ApiError from '../utils/ApiError.js';

/**
 * JWT Authentication Middleware
 * Extracts Bearer token, verifies it, attaches user to req.user
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token required');
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted in Redis
    const redis = getRedis();
    if (redis) {
      try {
        const isBlacklisted = await redis.get(`bl:${token}`);
        if (isBlacklisted) {
          throw ApiError.unauthorized('Token has been revoked');
        }
      } catch (redisErr) {
        // If Redis is down, skip blacklist check rather than crash
        if (redisErr instanceof ApiError) throw redisErr;
      }
    }

    // Verify JWT
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        display_name: true,
        avatar_url: true,
        status: true,
        is_verified: true,
        two_factor_enabled: true,
        online_status: true,
        theme_preference: true,
        language: true,
        timezone: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (user.status === 'banned') {
      throw ApiError.forbidden('Account has been banned');
    }

    if (user.status === 'deleted') {
      throw ApiError.unauthorized('Account has been deleted');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    if (err.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized('Invalid token'));
    }
    if (err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Token expired'));
    }
    next(ApiError.unauthorized('Authentication failed'));
  }
};

export default auth;
