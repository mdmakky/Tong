import mongoose from 'mongoose';

const { Schema } = mongoose;

const conversationVisibilitySchema = new Schema(
  {
    conversation_id: {
      type: String,
      required: true,
      index: true,
    },
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    hidden_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'conversation_visibility',
  }
);

conversationVisibilitySchema.index(
  { conversation_id: 1, user_id: 1 },
  { unique: true }
);

const ConversationVisibility = mongoose.model(
  'ConversationVisibility',
  conversationVisibilitySchema
);

export default ConversationVisibility;
