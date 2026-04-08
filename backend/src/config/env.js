import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Databases
  DATABASE_URL: process.env.DATABASE_URL,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DNS_SERVERS: (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean),
  REDIS_URL: process.env.REDIS_URL,

  // SMTP
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 465,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'Tong Messenger',

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  // App
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  ALLOWED_ORIGINS: (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean),

  // OTP
  OTP_EXPIRES_MINUTES: parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 10,
  OTP_LENGTH: parseInt(process.env.OTP_LENGTH, 10) || 6,

  // Upload Limits (bytes) — admin configurable via .env
  MAX_IMAGE_SIZE: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 10 * 1024 * 1024,       // 10MB
  MAX_VIDEO_SIZE: parseInt(process.env.MAX_VIDEO_SIZE, 10) || 100 * 1024 * 1024,      // 100MB
  MAX_AUDIO_SIZE: parseInt(process.env.MAX_AUDIO_SIZE, 10) || 25 * 1024 * 1024,       // 25MB
  MAX_DOCUMENT_SIZE: parseInt(process.env.MAX_DOCUMENT_SIZE, 10) || 50 * 1024 * 1024, // 50MB
};

// Validate required env vars
const required = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DATABASE_URL',
  'MONGODB_URI',
];

for (const key of required) {
  if (!env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

export default env;
