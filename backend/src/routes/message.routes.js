import { Router } from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import * as msgCtrl from '../controllers/message.controller.js';

const router = Router();

router.use(auth);

// ─── EDIT MESSAGE ──────────────────────────────
router.put(
  '/:id',
  [body('text').isString().isLength({ min: 1 }).withMessage('Message text required')],
  validate,
  msgCtrl.editMessage
);

// ─── DELETE MESSAGE ────────────────────────────
router.delete('/:id', msgCtrl.deleteMessage);

// ─── REACTIONS ─────────────────────────────────
router.post(
  '/:id/reactions',
  [body('emoji').isString().isLength({ min: 1, max: 10 }).withMessage('Emoji required')],
  validate,
  msgCtrl.addReaction
);
router.delete('/:id/reactions', msgCtrl.removeReaction);

// ─── PIN ───────────────────────────────────────
router.post('/:id/pin', msgCtrl.pinMessage);
router.get('/pinned/:conversationId', msgCtrl.getPinnedMessages);

// ─── FORWARD ───────────────────────────────────
router.post(
  '/:id/forward',
  [body('conversation_ids').isArray({ min: 1 }).withMessage('Target conversations required')],
  validate,
  msgCtrl.forwardMessage
);

// ─── STAR ──────────────────────────────────────
router.post('/:id/star', msgCtrl.starMessage);

export default router;
