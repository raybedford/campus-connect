require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 8000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/campus-connect',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
  ACCESS_TOKEN_EXPIRE: '30m',
  REFRESH_TOKEN_EXPIRE: '7d',
  VERIFICATION_CODE_EXPIRE_MINUTES: 10,
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173'],
  UPLOAD_DIR: 'backend/uploads',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  FILE_MAX_AGE_HOURS: 24,

  // Mailtrap / SMTP Config
  MAIL_HOST: process.env.MAIL_HOST || 'sandbox.smtp.mailtrap.io',
  MAIL_PORT: process.env.MAIL_PORT || 2525,
  MAIL_USER: process.env.MAIL_USER,
  MAIL_PASS: process.env.MAIL_PASS,
  MAIL_FROM: process.env.MAIL_FROM || 'no-reply@campus-connect.edu'
};
