// backend/models/File.js - Updated with auto-purge functionality
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
    required: false
  },
  path: {
    type: String,
    required: false
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Object,
    default: {}
  },
  // NEW FIELDS FOR AUTO-PURGE
  keepPermanently: {
    type: Boolean,
    default: false,
    description: 'If true, file will not be auto-purged'
  },
  purgeAt: {
    type: Date,
    default: function() {
      // Set purge date to 10 minutes from now by default
      // You can change this duration here
      const minutes = 10; // ⭐ ADJUST THIS VALUE TO CHANGE PURGE TIME
      return new Date(Date.now() + minutes * 60 * 1000);
    },
    description: 'Date when file should be automatically deleted'
  }
});

// Index for faster queries
fileSchema.index({ userId: 1, fileType: 1 });
fileSchema.index({ uploadDate: -1 });
// NEW INDEX: For efficient purge queries
fileSchema.index({ purgeAt: 1, keepPermanently: 1 });

module.exports = mongoose.model('File', fileSchema);