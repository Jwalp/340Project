// backend/routes/files.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const {
  uploadFile,
  getFiles,
  getFileById,
  deleteFile,
  downloadFile
} = require('../controllers/fileController');

// Configure multer for file uploads (store in memory for processing)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

// All routes require authentication
router.use(protect);

// File routes
router.post('/upload', upload.single('file'), uploadFile);
router.get('/', getFiles);
router.get('/:id', getFileById);
router.get('/:id/download', downloadFile);
router.delete('/:id', deleteFile);

module.exports = router;