import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import { uploadGroupAvatar, uploadChatMedia } from '../middleware/upload.js';
import * as groupCtrl from '../controllers/group.controller.js';

const router = Router();

router.use(auth);

// ─── GROUPS ────────────────────────────────────
router.get('/', groupCtrl.getGroups);

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Group name required (1-100 chars)'),
    body('type').optional().isIn(['public', 'private', 'secret']),
    body('max_members').optional().isInt({ min: 2, max: 1000 }),
    body('member_ids').optional().isArray(),
  ],
  validate,
  groupCtrl.createGroup
);

router.get('/:id', groupCtrl.getGroup);
router.put('/:id', uploadGroupAvatar, groupCtrl.updateGroup);
router.delete('/:id', groupCtrl.deleteGroup);

// ─── MEMBERS ───────────────────────────────────
router.get('/:id/members', groupCtrl.getMembers);
router.post(
  '/:id/members',
  [body('user_id').isUUID().withMessage('Valid user ID required')],
  validate,
  groupCtrl.addMember
);
router.delete('/:id/members/:uid', groupCtrl.removeMember);
router.put(
  '/:id/members/:uid/role',
  [body('role').isIn(['admin', 'moderator', 'member']).withMessage('Valid role required')],
  validate,
  groupCtrl.updateMemberRole
);

// ─── MUTE ──────────────────────────────────────
router.post(
  '/:id/members/:uid/mute',
  [body('duration').optional().isInt({ min: 1 }).withMessage('Duration in minutes')],
  validate,
  groupCtrl.muteMember
);

// ─── INVITE / JOIN / LEAVE ─────────────────────
router.post('/join/:invite_link', groupCtrl.joinByInvite);
router.post('/:id/leave', groupCtrl.leaveGroup);

// ─── MESSAGES ──────────────────────────────────
router.get('/:id/messages', groupCtrl.getGroupMessages);
router.post('/:id/messages', uploadChatMedia, groupCtrl.sendGroupMessage);
router.get('/:id/media', groupCtrl.getGroupMedia);

// ─── POLLS ─────────────────────────────────────
router.post(
  '/:id/polls',
  [
    body('question').trim().isLength({ min: 1 }).withMessage('Question required'),
    body('options').isArray({ min: 2 }).withMessage('At least 2 options required'),
  ],
  validate,
  groupCtrl.createPoll
);

export default router;
