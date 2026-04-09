import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import env from '../config/env.js';
import '../config/cloudinary.js'; // Initialize cloudinary config

// ─── Cloudinary Storage for different media types ───

const createStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      let resourceType = 'auto';
      let format;

      if (file.mimetype.startsWith('image/')) {
        resourceType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        resourceType = 'video';
      } else if (file.mimetype.startsWith('audio/')) {
        resourceType = 'video'; // Cloudinary stores audio as video type
      } else {
        resourceType = 'raw';
      }

      return {
        folder: `tong/${folder}`,
        resource_type: resourceType,
        format,
        transformation: file.mimetype.startsWith('image/')
          ? [{ quality: 'auto:good', fetch_format: 'auto' }]
          : undefined,
      };
    },
  });
};

// ─── File Filters ───

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, GIF, and WEBP images are allowed'), false);
  }
};

const mediaFilter = (req, file, cb) => {
  const allowed = [
    // images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // videos
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
    // audio
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/webm',
    // documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not supported`), false);
  }
};

// ─── Upload Middleware Exports ───

/**
 * Avatar upload — single image, max size from env
 */
export const uploadAvatar = multer({
  storage: createStorage('avatars'),
  limits: { fileSize: env.MAX_IMAGE_SIZE },
  fileFilter: imageFilter,
}).single('avatar');

/**
 * Group avatar upload
 */
export const uploadGroupAvatar = multer({
  storage: createStorage('groups'),
  limits: { fileSize: env.MAX_IMAGE_SIZE },
  fileFilter: imageFilter,
}).single('avatar');

/**
 * Chat media upload — single file (image/video/audio/doc)
 * Size limit determined by file type at validation layer
 */
export const uploadChatMedia = multer({
  storage: createStorage('chat'),
  limits: { fileSize: env.MAX_VIDEO_SIZE }, // Use largest limit, validate per-type in controller
  fileFilter: mediaFilter,
}).single('file');

/**
 * Delete a file from Cloudinary by public_id
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
    return null;
  }
};
