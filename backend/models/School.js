const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  domain: { type: String, unique: true, required: true }, // e.g. "coloradotech.edu"
  name: { type: String },
  logoUrl: { type: String }, // URL to school logo
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('School', schoolSchema);
