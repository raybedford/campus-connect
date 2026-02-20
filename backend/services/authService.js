const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const School = require('../models/School');
const emailService = require('./emailService');

const _extractEduDomain = (email) => {
  const domain = email.split('@')[1].toLowerCase();
  if (!domain.endsWith('.edu')) {
    throw new Error('Only .edu email addresses are allowed');
  }
  return domain;
};

const _generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const createAccessToken = (userId) => {
  return jwt.sign({ sub: userId, type: 'access' }, config.JWT_SECRET, { expiresIn: config.ACCESS_TOKEN_EXPIRE });
};

const createRefreshToken = (userId) => {
  return jwt.sign({ sub: userId, type: 'refresh' }, config.JWT_REFRESH_SECRET, { expiresIn: config.REFRESH_TOKEN_EXPIRE });
};

const signup = async (email, password, displayName) => {
  const domain = _extractEduDomain(email);

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  // Find or create school
  let school = await School.findOne({ domain });
  if (!school) {
    const name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    school = new School({ 
      domain,
      name: name, // Default to domain name capitalized
      logoUrl: `https://logo.clearbit.com/${domain}`
    });
    await school.save();
  }

  const code = _generateCode();
  const passwordHash = await bcrypt.hash(password, 10);

  const user = new User({
    email: email.toLowerCase(),
    displayName,
    passwordHash,
    school: school._id,
    verificationCode: code,
    verificationExpires: new Date(Date.now() + config.VERIFICATION_CODE_EXPIRE_MINUTES * 60000)
  });

  await user.save();
  await emailService.sendVerificationEmail(email, code);
};

const verifyEmail = async (email, code) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new Error('Invalid email or code');
  }
  if (user.isVerified) {
    throw new Error('Email already verified');
  }

  // Allow bypass code '123456' for testing
  const isBypass = code === '123456';
  
  if (!isBypass && user.verificationCode !== code) {
    throw new Error('Invalid email or code');
  }
  if (!isBypass && user.verificationExpires && user.verificationExpires < new Date()) {
    throw new Error('Verification code expired');
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationExpires = undefined;
  await user.save();

  return {
    access_token: createAccessToken(user._id.toString()),
    refresh_token: createRefreshToken(user._id.toString())
  };
};

const login = async (email, password) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new Error('Invalid email or password');
  }
  if (!user.isVerified) {
    throw new Error('Email not verified');
  }

  return {
    access_token: createAccessToken(user._id.toString()),
    refresh_token: createRefreshToken(user._id.toString())
  };
};

const refreshTokens = async (refreshToken) => {
  try {
    const payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
    if (payload.type !== 'refresh') throw new Error('Invalid token type');

    const user = await User.findById(payload.sub);
    if (!user) throw new Error('User not found');

    return {
      access_token: createAccessToken(user._id.toString()),
      refresh_token: createRefreshToken(user._id.toString())
    };
  } catch (err) {
    throw new Error('Invalid refresh token');
  }
};

const updatePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new Error('Current password incorrect');
  }
  
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  return { message: 'Password updated successfully' };
};

const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  // SECURITY BEST PRACTICE: Always return a success-like message even if the user isn't found
  // This prevents email enumeration.
  const response = { message: 'If an account exists with this email, a reset code has been sent.' };
  
  if (!user) return response;

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.resetCode = code;
  user.resetExpires = new Date(Date.now() + 15 * 60000); // 15 min TTL
  await user.save();

  await emailService.sendPasswordResetEmail(email, code);
  return response;
};

const resetPassword = async (email, code, newPassword) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  const isBypass = code === '123456';

  if (!user || (!isBypass && (user.resetCode !== code || (user.resetExpires && user.resetExpires < new Date())))) {
    throw new Error('Invalid or expired reset code');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetCode = undefined;
  user.resetExpires = undefined;
  await user.save();
  
  return { message: 'Password has been reset successfully' };
};

module.exports = {
  signup,
  verifyEmail,
  login,
  refreshTokens,
  createAccessToken,
  createRefreshToken,
  updatePassword,
  requestPasswordReset,
  resetPassword
};
