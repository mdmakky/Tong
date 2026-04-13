import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import { uploadChatMedia } from '../middleware/upload.js';
import * as convCtrl from '../controllers/conversation.controller.js';

const router = Router();

router.use(auth);

// ─── CONVERSATIONS ─────────────────────────────
router.get('/', convCtrl.getConversations);

router.post(
  '/',
  [
    body('participant_id').isUUID().withMessage('Valid participant ID required'),
    body('type').optional().isIn(['direct', 'private_encrypted']),
  ],
  validate,
  convCtrl.createConversation
);

router.get('/:id', convCtrl.getConversation);
router.delete('/:id', convCtrl.deleteConversation);

// ─── NICKNAME ──────────────────────────────────
router.post(
  '/nicknames/bulk',
  [
    body('conversation_ids').isArray({ min: 1 }).withMessage('conversation_ids must be a non-empty array'),
    body('conversation_ids.*').isUUID().withMessage('Valid conversation ID required'),
  ],
  validate,
  convCtrl.getNicknamesBulk
);
router.put('/:id/nickname', convCtrl.setNickname);
router.get('/:id/nickname', convCtrl.getNickname);
router.put('/:id/self-nickname', convCtrl.setSelfNickname);
router.get('/:id/self-nickname', convCtrl.getSelfNickname);

// ─── FRIEND REQUESTS ───────────────────────────
router.post('/:id/accept-request', convCtrl.acceptFriendRequest);
router.post('/:id/decline-request', convCtrl.declineFriendRequest);

// ─── MESSAGES ──────────────────────────────────
router.get('/:id/messages', convCtrl.getMessages);

router.post(
  '/:id/messages',
  uploadChatMedia,
  [
    body('message_type').optional().isIn(['text', 'image', 'video', 'audio', 'file', 'sticker', 'location']),
  ],
  validate,
  convCtrl.sendMessage
);

// ─── MEDIA GALLERY ─────────────────────────────
router.get('/:id/media', convCtrl.getMediaGallery);

// ─── SEARCH ────────────────────────────────────
router.get('/:id/search', convCtrl.searchMessages);

export default router;
