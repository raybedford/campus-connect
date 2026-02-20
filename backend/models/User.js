const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  displayName: { type: String, required: true },
  passwordHash: { type: String, required: true }, // bcrypt
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String }, // 6-digit
  verificationExpires: { type: Date }, // 10 min TTL
  
  // Security & Profile Extensions
  phoneNumber: { type: String },
  isPhoneVerified: { type: Boolean, default: false },
  phoneVerificationCode: { type: String },
  phoneVerificationExpires: { type: Date },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String }, // For TOTP
  showPhoneInProfile: { type: Boolean, default: false },
  
  // Password Reset
  resetCode: { type: String },
  resetExpires: { type: Date },
  
  // Account Deletion
  deletionScheduledAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  lastSeen: { type: Date }
});

module.exports = mongoose.model('User', userSchema);
