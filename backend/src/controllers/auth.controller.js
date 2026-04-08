import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '../config/database.js';
import { generateTokenPair, verifyRefreshToken, blacklistToken } from '../services/token.service.js';
import { generateOTP, storeOTP, verifyOTP } from '../services/otp.service.js';
import { sendOTPEmail } from '../services/email.service.js';
import { parseUserAgent, sanitizeUser } from '../utils/helpers.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

// ─── REGISTER ──────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const { username, email, password, display_name, phone } = req.body;

    // Check existing user
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      if (existing.email === email) throw ApiError.conflict('Email already registered');
      if (existing.username === username) throw ApiError.conflict('Username already taken');
    }

    // Hash password (cost 12 per SRS)
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        phone: phone || null,
        password_hash,
        display_name: display_name || username,
      },
    });

    // Generate & send OTP for email verification
    const otp = generateOTP();
    await storeOTP('email_verify', email, otp);
    // Send email in background — don't block response
    sendOTPEmail(email, otp, 'verify').catch((err) => {
      console.error('OTP email failed:', err.message);
    });

    // Generate tokens
    const tokens = generateTokenPair(user.id);

    // Store device info
    const { device_name, device_type } = parseUserAgent(req.headers['user-agent']);
    await prisma.userDevice.create({
      data: {
        user_id: user.id,
        device_name,
        device_type,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        refresh_token: tokens.refreshToken,
      },
    });

    return ApiResponse.created('Account created. Please verify your email.', {
      user: sanitizeUser(user),
      ...tokens,
    }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── LOGIN ─────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password, totp_code } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw ApiError.unauthorized('Invalid email or password');

    if (user.status === 'banned') throw ApiError.forbidden('Account has been banned');
    if (user.status === 'deleted') throw ApiError.unauthorized('Account has been deleted');

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) throw ApiError.unauthorized('Invalid email or password');

    // Check 2FA if enabled
    if (user.two_factor_enabled) {
      if (!totp_code) {
        return res.status(200).json({
          success: true,
          message: '2FA code required',
          data: { requires_2fa: true },
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: totp_code,
        window: 1,
      });

      if (!verified) throw ApiError.unauthorized('Invalid 2FA code');
    }

    // Generate tokens
    const tokens = generateTokenPair(user.id);

    // Update last_seen
    await prisma.user.update({
      where: { id: user.id },
      data: { last_seen: new Date() },
    });

    // Store/update device
    const { device_name, device_type } = parseUserAgent(req.headers['user-agent']);
    await prisma.userDevice.create({
      data: {
        user_id: user.id,
        device_name,
        device_type,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        refresh_token: tokens.refreshToken,
      },
    });

    return ApiResponse.ok('Login successful', {
      user: sanitizeUser(user),
      ...tokens,
    }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── LOGOUT ────────────────────────────────────
export const logout = async (req, res, next) => {
  try {
    // Blacklist current access token
    await blacklistToken(req.token);

    // Remove device entry for this refresh token if provided
    const { refresh_token } = req.body;
    if (refresh_token) {
      await prisma.userDevice.deleteMany({
        where: {
          user_id: req.user.id,
          refresh_token,
        },
      });
      await blacklistToken(refresh_token);
    }

    return ApiResponse.ok('Logged out successfully').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── REFRESH TOKEN ─────────────────────────────
export const refreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) throw ApiError.badRequest('Refresh token required');

    // Verify refresh token
    const decoded = verifyRefreshToken(refresh_token);

    // Check if device exists with this refresh token
    const device = await prisma.userDevice.findFirst({
      where: {
        user_id: decoded.userId,
        refresh_token,
      },
    });

    if (!device) throw ApiError.unauthorized('Invalid refresh token');

    // Generate new token pair (rotation)
    const tokens = generateTokenPair(decoded.userId);

    // Update device with new refresh token
    await prisma.userDevice.update({
      where: { id: device.id },
      data: {
        refresh_token: tokens.refreshToken,
        last_active: new Date(),
      },
    });

    // Blacklist old refresh token
    await blacklistToken(refresh_token);

    return ApiResponse.ok('Token refreshed', tokens).send(res);
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Invalid or expired refresh token'));
    }
    next(err);
  }
};

// ─── FORGOT PASSWORD ───────────────────────────
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success (don't reveal if email exists)
    if (!user) {
      return ApiResponse.ok('If the email exists, a reset code has been sent.').send(res);
    }

    const otp = generateOTP();
    await storeOTP('password_reset', email, otp);
    sendOTPEmail(email, otp, 'reset').catch((err) => {
      console.error('Password reset email failed:', err.message);
    });

    return ApiResponse.ok('If the email exists, a reset code has been sent.').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── RESET PASSWORD ────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;

    const valid = await verifyOTP('password_reset', email, otp);
    if (!valid) throw ApiError.badRequest('Invalid or expired OTP');

    const password_hash = await bcrypt.hash(new_password, 12);
    await prisma.user.update({
      where: { email },
      data: { password_hash },
    });

    return ApiResponse.ok('Password reset successfully').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── VERIFY EMAIL ──────────────────────────────
export const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const valid = await verifyOTP('email_verify', email, otp);
    if (!valid) throw ApiError.badRequest('Invalid or expired OTP');

    await prisma.user.update({
      where: { email },
      data: { is_verified: true },
    });

    return ApiResponse.ok('Email verified successfully').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── ENABLE 2FA ────────────────────────────────
export const enable2FA = async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `tong:${req.user.email}`,
      issuer: 'tong',
    });

    // Store secret temporarily (user must verify before it's final)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { two_factor_secret: secret.base32 },
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return ApiResponse.ok('Scan the QR code with your authenticator app', {
      secret: secret.base32,
      qr_code: qrCodeUrl,
    }).send(res);
  } catch (err) {
    next(err);
  }
};

// ─── VERIFY 2FA (Confirm setup) ────────────────
export const verify2FA = async (req, res, next) => {
  try {
    const { totp_code } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { two_factor_secret: true },
    });

    if (!user.two_factor_secret) {
      throw ApiError.badRequest('2FA has not been initialized. Call enable endpoint first.');
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: totp_code,
      window: 1,
    });

    if (!verified) throw ApiError.badRequest('Invalid 2FA code');

    // Mark 2FA as enabled
    await prisma.user.update({
      where: { id: req.user.id },
      data: { two_factor_enabled: true },
    });

    return ApiResponse.ok('2FA enabled successfully').send(res);
  } catch (err) {
    next(err);
  }
};

// ─── RESEND OTP ────────────────────────────────
export const resendOTP = async (req, res, next) => {
  try {
    const { email, type } = req.body; // type: 'verify' or 'reset'

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return ApiResponse.ok('If the email exists, a new code has been sent.').send(res);
    }

    const otpType = type === 'reset' ? 'password_reset' : 'email_verify';
    const otp = generateOTP();
    await storeOTP(otpType, email, otp);
    sendOTPEmail(email, otp, type || 'verify').catch(console.error);

    return ApiResponse.ok('If the email exists, a new code has been sent.').send(res);
  } catch (err) {
    next(err);
  }
};
