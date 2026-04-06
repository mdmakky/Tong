import crypto from 'crypto';

/**
 * Generate a random string of specified length
 */
export const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};

/**
 * Generate a unique invite link code
 */
export const generateInviteLink = () => {
  return crypto.randomBytes(16).toString('base64url');
};

/**
 * Parse user-agent string to get device info
 */
export const parseUserAgent = (ua) => {
  if (!ua) return { device_name: 'Unknown', device_type: 'web' };

  let device_type = 'web';
  if (/mobile|android|iphone|ipad/i.test(ua)) device_type = 'mobile';
  else if (/electron|desktop/i.test(ua)) device_type = 'desktop';

  // Extract browser name
  let device_name = 'Unknown Browser';
  if (/firefox/i.test(ua)) device_name = 'Firefox';
  else if (/edg/i.test(ua)) device_name = 'Edge';
  else if (/chrome/i.test(ua)) device_name = 'Chrome';
  else if (/safari/i.test(ua)) device_name = 'Safari';
  else if (/opera|opr/i.test(ua)) device_name = 'Opera';

  return { device_name, device_type };
};

/**
 * Paginate query results
 */
export const getPagination = (page = 1, limit = 50) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (p - 1) * l;
  return { page: p, limit: l, skip };
};

/**
 * Sanitize user object for public consumption (remove sensitive fields)
 */
export const sanitizeUser = (user) => {
  if (!user) return null;
  const { password_hash, two_factor_secret, refresh_token, ...safe } = user;
  return safe;
};
