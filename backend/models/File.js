// backend/models/File.js
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['document', 'image', 'audio', 'video'],
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gridFSId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false // Only for large files
  },
  path: {
    type: String,
    required: false // Only for small files stored locally
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Object,
    default: {}
  }
});

// Index for faster queries
fileSchema.index({ userId: 1, fileType: 1 });
fileSchema.index({ uploadDate: -1 });

module.exports = mongoose.model('File', fileSchema);