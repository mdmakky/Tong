import cloudinary from '../config/cloudinary.js';

/**
 * Upload a buffer to Cloudinary
 */
export const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'tong/general',
        resource_type: options.resource_type || 'auto',
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

/**
 * Delete from Cloudinary by public_id
 */
export const deleteCloudinaryFile = async (publicId, resourceType = 'image') => {
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('Cloudinary delete error:', err.message);
    return null;
  }
};

/**
 * Get public_id from a Cloudinary URL
 */
export const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  try {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;
    // Skip version (v1234567890)
    const pathParts = parts.slice(uploadIndex + 2);
    const lastPart = pathParts.join('/');
    // Remove file extension
    return lastPart.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
};
