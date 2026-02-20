const mongoose = require('mongoose');

const publicKeySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  keyType: { type: String, default: 'x25519' },
  publicKeyB64: { type: String, required: true }, // 32-byte Curve25519, base64
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Index for fast public key retrieval
publicKeySchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('PublicKey', publicKeySchema);
