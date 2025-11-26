// backend/controllers/fileController.js
const File = require('../models/File');
const mongoose = require('mongoose');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');

// File type mappings
const FILE_TYPES = {
  document: [
    // PDF
    'application/pdf',
    // Microsoft Office
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text formats
    'text/plain',
    'text/markdown',
    'text/html',
    'application/xhtml+xml',
    'text/css',
    'text/csv',
    // Rich Text Format
    'application/rtf',
    'text/rtf',
    // OpenDocument Format
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    // EPUB
    'application/epub+zip',
    // Other document formats
    'application/xml',
    'text/xml',
    'application/json',
    'text/x-markdown'
  ],
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/heic',
    'image/heif'
  ],
  audio: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/m4a',
    'audio/webm'
  ],
  video: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
    'video/mpeg',
    'video/x-flv'
  ]
};

// Get file type category
const getFileCategory = (mimeType) => {
  for (const [category, types] of Object.entries(FILE_TYPES)) {
    if (types.includes(mimeType)) {
      return category;
    }
  }
  return null;
};

// Initialize GridFS
let gfsBucket;
mongoose.connection.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

// Upload file
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    
    // Check file type
    const fileCategory = getFileCategory(mimetype);
    if (!fileCategory) {
      return res.status(400).json({
        success: false,
        message: 'File type not supported. Please upload documents, images, audio, or video files only.'
      });
    }

    // Generate unique filename
    const filename = `${Date.now()}-${originalname}`;
    const fileSize = size;
    const isLargeFile = fileSize > 16 * 1024 * 1024; // 16MB threshold for GridFS

    let fileDoc;

    if (isLargeFile) {
      // Use GridFS for large files
      const readableStream = Readable.from(buffer);
      const uploadStream = gfsBucket.openUploadStream(filename, {
        metadata: {
          originalName: originalname,
          userId: req.user.id,
          fileType: fileCategory,
          mimeType: mimetype
        }
      });

      await new Promise((resolve, reject) => {
        readableStream
          .pipe(uploadStream)
          .on('error', reject)
          .on('finish', resolve);
      });

      // Save file metadata to database
      fileDoc = await File.create({
        filename,
        originalName: originalname,
        fileType: fileCategory,
        mimeType: mimetype,
        size: fileSize,
        userId: req.user.id,
        gridFSId: uploadStream.id
      });
    } else {
      // Store small files locally
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);

      // Save file metadata to database
      fileDoc = await File.create({
        filename,
        originalName: originalname,
        fileType: fileCategory,
        mimeType: mimetype,
        size: fileSize,
        userId: req.user.id,
        path: filePath
      });
    }

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: fileDoc._id,
        filename: fileDoc.originalName,
        fileType: fileDoc.fileType,
        size: fileDoc.size,
        uploadDate: fileDoc.uploadDate
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
};

// Get user's files
exports.getFiles = async (req, res) => {
  try {
    const { fileType, sortBy = 'uploadDate', order = 'desc' } = req.query;
    
    const query = { userId: req.user.id };
    if (fileType && ['document', 'image', 'audio', 'video'].includes(fileType)) {
      query.fileType = fileType;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const sortField = sortBy || 'uploadDate';

    const files = await File.find(query)
      .sort({ [sortField]: sortOrder })
      .select('-path -gridFSId');

    res.status(200).json({
      success: true,
      count: files.length,
      files: files.map(file => ({
        id: file._id,
        filename: file.originalName,
        fileType: file.fileType,
        mimeType: file.mimeType,
        size: file.size,
        uploadDate: file.uploadDate
      }))
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve files'
    });
  }
};

// Get file by ID
exports.getFileById = async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).select('-path -gridFSId');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.status(200).json({
      success: true,
      file: {
        id: file._id,
        filename: file.originalName,
        fileType: file.fileType,
        mimeType: file.mimeType,
        size: file.size,
        uploadDate: file.uploadDate
      }
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve file'
    });
  }
};

// Download file
exports.downloadFile = async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`
    });

    if (file.gridFSId) {
      // Stream from GridFS
      const downloadStream = gfsBucket.openDownloadStream(file.gridFSId);
      downloadStream.pipe(res);
    } else if (file.path) {
      // Send local file
      res.sendFile(file.path);
    } else {
      return res.status(500).json({
        success: false,
        message: 'File data not found'
      });
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
};

// Delete file
exports.deleteFile = async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete from GridFS or local storage
    if (file.gridFSId) {
      await gfsBucket.delete(file.gridFSId);
    } else if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Delete from database
    await File.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
};