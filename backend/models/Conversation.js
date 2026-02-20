const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  type: { type: String, enum: ['dm', 'group'], required: true },
  name: { type: String }, // null for DMs
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Compound index on members.user + type for DM dedup
conversationSchema.index({ 'members.user': 1, type: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
