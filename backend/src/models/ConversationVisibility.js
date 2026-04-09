import mongoose from 'mongoose';

const conversationVisibilitySchema = new mongoose.Schema(
  {
    conversation_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'conversation_visibility',
  }
);

conversationVisibilitySchema.index({ conversation_id: 1, user_id: 1 }, { unique: true });

const ConversationVisibility = mongoose.model('ConversationVisibility', conversationVisibilitySchema);

export default ConversationVisibility;
