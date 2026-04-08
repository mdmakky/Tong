import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import { authLimiter, strictLimiter } from '../middleware/rateLimiter.js';
import auth from '../middleware/auth.js';
import * as authCtrl from '../controllers/auth.controller.js';

const router = Router();

// ─── REGISTER ──────────────────────────────────
router.post(
  '/register',
  authLimiter,
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be 3-50 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
    body('display_name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Display name must be 1-100 characters'),
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Valid phone number required'),
  ],
  validate,
  authCtrl.register
);

// ─── LOGIN ─────────────────────────────────────
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    body('totp_code').optional().isLength({ min: 6, max: 6 }),
  ],
  validate,
  authCtrl.login
);

// ─── LOGOUT ────────────────────────────────────
router.post('/logout', auth, authCtrl.logout);

// ─── REFRESH TOKEN ─────────────────────────────
router.post(
  '/refresh',
  [body('refresh_token').notEmpty().withMessage('Refresh token required')],
  validate,
  authCtrl.refreshToken
);

// ─── FORGOT PASSWORD ───────────────────────────
router.post(
  '/forgot-password',
  strictLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
  validate,
  authCtrl.forgotPassword
);

// ─── RESET PASSWORD ────────────────────────────
router.post(
  '/reset-password',
  strictLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Valid OTP required'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  validate,
  authCtrl.resetPassword
);

// ─── VERIFY EMAIL ──────────────────────────────
router.post(
  '/verify-email',
  strictLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Valid OTP required'),
  ],
  validate,
  authCtrl.verifyEmail
);

// ─── RESEND OTP ────────────────────────────────
router.post(
  '/resend-otp',
  strictLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('type').optional().isIn(['verify', 'reset']),
  ],
  validate,
  authCtrl.resendOTP
);

// ─── 2FA ───────────────────────────────────────
router.post('/2fa/enable', auth, authCtrl.enable2FA);
router.post(
  '/2fa/verify',
  auth,
  [body('totp_code').isLength({ min: 6, max: 6 }).withMessage('Valid 2FA code required')],
  validate,
  authCtrl.verify2FA
);

export default router;
