import mongoose from 'mongoose';

const { Schema } = mongoose;

// ─── Reaction Sub-schema ───
const reactionSchema = new Schema(
  {
    user_id: { type: String, required: true },
    emoji: { type: String, required: true },
    reacted_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Read Receipt Sub-schema ───
const readReceiptSchema = new Schema(
  {
    user_id: { type: String, required: true },
    read_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Edit History Sub-schema ───
const editHistorySchema = new Schema(
  {
    content: { type: String },
    edited_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Content Sub-schema ───
const contentSchema = new Schema(
  {
    text: { type: String },
    media_url: { type: String },
    media_type: { type: String }, // MIME type
    media_size: { type: Number }, // bytes
    thumbnail_url: { type: String },
    file_name: { type: String },
    duration: { type: Number }, // seconds (audio/video)
    location: {
      lat: Number,
      lng: Number,
      name: String,
    },
    is_encrypted: { type: Boolean, default: false },
    encrypted_content: { type: String },
  },
  { _id: false }
);

// ─── Main Message Schema ───
const messageSchema = new Schema(
  {
    conversation_id: {
      type: String,
      required: true,
      index: true,
    },
    conversation_type: {
      type: String,
      required: true,
      enum: ['direct', 'group', 'private'],
    },
    sender_id: {
      type: String,
      required: true,
      index: true,
    },
    message_type: {
      type: String,
      required: true,
      enum: ['text', 'image', 'video', 'audio', 'file', 'sticker', 'location', 'reply', 'forwarded', 'system'],
      default: 'text',
    },
    content: contentSchema,
    reply_to: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    forwarded_from: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    reactions: [reactionSchema],
    read_receipts: [readReceiptSchema],
    delivered_to: [{ type: String }],
    is_pinned: { type: Boolean, default: false },
    is_edited: { type: Boolean, default: false },
    edit_history: [editHistorySchema],
    is_deleted: { type: Boolean, default: false },
    deleted_for: [{ type: String }], // user IDs who deleted for themselves
    deleted_for_all: { type: Boolean, default: false },
    expires_at: { type: Date, default: null }, // Disappearing messages
    is_announcement: { type: Boolean, default: false },
    mentions: [{ type: String }], // user IDs mentioned
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'messages',
  }
);

// ─── Indexes ───
messageSchema.index({ conversation_id: 1, created_at: -1 });
messageSchema.index({ sender_id: 1, created_at: -1 });
messageSchema.index({ conversation_id: 1, is_pinned: 1 });
messageSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index for disappearing messages
messageSchema.index({ 'content.text': 'text' }); // Text search index

const Message = mongoose.model('Message', messageSchema);

export default Message;
