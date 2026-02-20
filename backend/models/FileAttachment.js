const mongoose = require('mongoose');

const fileAttachmentSchema = new mongoose.Schema({
  message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  originalFilename: { type: String, required: true },
  storedFilename: { type: String, required: true }, // UUID-based
  fileSizeBytes: { type: Number, required: true }, // Max 10MB
  mimeType: { type: String },
  totalRecipients: { type: Number, required: true },
  downloads: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    downloadedAt: { type: Date, default: Date.now }
  }],
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FileAttachment', fileAttachmentSchema);
