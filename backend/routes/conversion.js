// backend/routes/conversion.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  convertMedia,
  checkFFmpegStatus
} = require('../controllers/conversionController');

// All routes require authentication
router.use(protect);

// Conversion routes
router.post('/convert', convertMedia);
router.get('/ffmpeg-status', checkFFmpegStatus);

module.exports = router;