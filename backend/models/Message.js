const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messageType: { type: String, enum: ['text', 'file'], required: true },
  encryptedPayloads: [{
    recipientId: { type: String, required: true },
    ciphertextB64: { type: String, required: true },
    nonceB64: { type: String, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Index for fast message history retrieval
messageSchema.index({ conversation: 1, _id: -1 });

module.exports = mongoose.model('Message', messageSchema);
