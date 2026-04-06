import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import { uploadAvatar as uploadAvatarMiddleware } from '../middleware/upload.js';
import * as userCtrl from '../controllers/user.controller.js';

const router = Router();

// All routes require auth
router.use(auth);

// ─── PROFILE ───────────────────────────────────
router.get('/me', userCtrl.getMe);
router.put(
  '/me',
  [
    body('display_name').optional().trim().isLength({ min: 1, max: 100 }),
    body('bio').optional().trim().isLength({ max: 500 }),
    body('username').optional().trim().isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_]+$/),
    body('phone').optional().isMobilePhone(),
    body('theme_preference').optional().isIn(['light', 'dark', 'system']),
    body('language').optional().isLength({ min: 2, max: 10 }),
    body('online_status').optional().isIn(['online', 'away', 'busy', 'invisible']),
    body('last_seen_visibility').optional().isIn(['everyone', 'contacts', 'nobody']),
    body('avatar_visibility').optional().isIn(['everyone', 'contacts', 'nobody']),
  ],
  validate,
  userCtrl.updateMe
);

// ─── AVATAR ────────────────────────────────────
router.post('/me/avatar', uploadAvatarMiddleware, userCtrl.uploadAvatar);

// ─── SEARCH ────────────────────────────────────
router.get('/search', userCtrl.searchUsers);

// ─── DEVICES ───────────────────────────────────
router.get('/me/devices', userCtrl.getMyDevices);
router.delete('/me/devices/:deviceId', userCtrl.removeDevice);

// ─── ACCOUNT ───────────────────────────────────
router.delete('/me', userCtrl.deleteAccount);

// ─── OTHER USER ────────────────────────────────
router.get('/:id', userCtrl.getUserById);
router.post('/:id/block', userCtrl.blockUser);
router.delete('/:id/block', userCtrl.unblockUser);
router.post(
  '/:id/report',
  [
    body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('Reason required (5-500 chars)'),
    body('details').optional().trim().isLength({ max: 2000 }),
  ],
  validate,
  userCtrl.reportUser
);

export default router;
