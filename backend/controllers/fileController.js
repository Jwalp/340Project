const File = require('../models/File');
const mongoose = require('mongoose');
const { Readable } = require('stream');

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
    'image/heif',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    // CRITICAL: Add fallback for .ico files
    'application/octet-stream' // Many .ico files report as this
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

// Extension to category mapping for fallback
const EXTENSION_CATEGORIES = {
  // Documents
  pdf: 'document', doc: 'document', docx: 'document',
  xls: 'document', xlsx: 'document',
  txt: 'document', md: 'document', markdown: 'document',
  html: 'document', htm: 'document', css: 'document', csv: 'document',
  rtf: 'document', odt: 'document', ods: 'document',
  epub: 'document', xml: 'document', json: 'document',
  
  // Images
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
  webp: 'image', svg: 'image', bmp: 'image',
  heic: 'image', heif: 'image',
  ico: 'image', icon: 'image',  // CRITICAL: .ico support
  
  // Audio
  mp3: 'audio', wav: 'audio', ogg: 'audio',
  aac: 'audio', flac: 'audio', m4a: 'audio', webm: 'audio',
  
  // Video
  mp4: 'video', mov: 'video', avi: 'video',
  mkv: 'video', mpeg: 'video', flv: 'video'
};

// ENHANCED Get file type category with extension fallback
const getFileCategory = (mimeType, filename = '') => {
  // SPECIAL CASE: .ico files with application/octet-stream
  if (filename && mimeType === 'application/octet-stream') {
    const extension = filename.toLowerCase().split('.').pop();
    if (extension === 'ico' || extension === 'icon') {
      console.log(`✅ .ico file detected via extension fallback: ${filename}`);
      return 'image';
    }
  }

  // First, try MIME type matching
  for (const [category, types] of Object.entries(FILE_TYPES)) {
    if (types.includes(mimeType)) {
      return category;
    }
  }
  
  // Fallback: Check file extension
  if (filename) {
    const extension = filename.toLowerCase().split('.').pop();
    if (extension && EXTENSION_CATEGORIES[extension]) {
      console.log(`⚠️ Using extension fallback for ${filename} (MIME: ${mimeType}) -> ${EXTENSION_CATEGORIES[extension]}`);
      return EXTENSION_CATEGORIES[extension];
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
  console.log('GridFS bucket initialized');
});

// Upload file - ALL FILES GO TO GRIDFS
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    
    // Get keepPermanently flag from request body
    const keepPermanently = req.body.keepPermanently === 'true';
    
    // Check file type - NOW PASSES FILENAME FOR EXTENSION CHECKING
    const fileCategory = getFileCategory(mimetype, originalname);
    if (!fileCategory) {
      console.log(`❌ File rejected: ${originalname} (MIME: ${mimetype})`);
      return res.status(400).json({
        success: false,
        message: 'File type not supported. Please upload documents, images, audio, or video files only.'
      });
    }

    console.log(`✅ File accepted: ${originalname} -> ${fileCategory} (MIME: ${mimetype})`);

    // Generate unique filename
    const filename = `${Date.now()}-${originalname}`;

    // Upload ALL files to GridFS (no local storage)
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

    // Save file metadata to database with keepPermanently flag
    const fileDoc = await File.create({
      filename,
      originalName: originalname,
      fileType: fileCategory,
      mimeType: mimetype,
      size: size,
      userId: req.user.id,
      gridFSId: uploadStream.id,
      keepPermanently: keepPermanently,
      purgeAt: keepPermanently ? null : new Date(Date.now() + 10 * 60 * 1000) // 10 min or null
    });

    const keepMsg = keepPermanently ? ' (kept permanently)' : ' (will auto-delete in 10 min)';
    console.log(`📁 File saved: ${originalname}${keepMsg}`);

    res.status(201).json({
      success: true,
      message: `File uploaded successfully${keepMsg}`,
      file: {
        id: fileDoc._id,
        filename: fileDoc.originalName,
        fileType: fileDoc.fileType,
        size: fileDoc.size,
        uploadDate: fileDoc.uploadDate,
        keepPermanently: fileDoc.keepPermanently,
        purgeAt: fileDoc.purgeAt
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

// Update keep status for existing file
exports.updateKeepStatus = async (req, res) => {
  try {
    const { keepPermanently } = req.body;
    
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

    // Update keep status
    file.keepPermanently = keepPermanently;
    file.purgeAt = keepPermanently ? null : new Date(Date.now() + 10 * 60 * 1000);
    await file.save();

    const statusMsg = keepPermanently ? 'kept permanently' : 'set to auto-delete in 10 minutes';
    console.log(`🔄 File ${file.originalName} ${statusMsg}`);

    res.status(200).json({
      success: true,
      message: `File ${statusMsg}`,
      file: {
        id: file._id,
        filename: file.originalName,
        fileType: file.fileType,
        size: file.size,
        uploadDate: file.uploadDate,
        keepPermanently: file.keepPermanently,
        purgeAt: file.purgeAt
      }
    });
  } catch (error) {
    console.error('Update keep status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file status'
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
      .select('-gridFSId');

    res.status(200).json({
      success: true,
      count: files.length,
      files: files.map(file => ({
        id: file._id,
        filename: file.originalName,
        fileType: file.fileType,
        mimeType: file.mimeType,
        size: file.size,
        uploadDate: file.uploadDate,
        keepPermanently: file.keepPermanently,
        purgeAt: file.purgeAt
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
    }).select('-gridFSId');

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
        uploadDate: file.uploadDate,
        keepPermanently: file.keepPermanently,
        purgeAt: file.purgeAt
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

// Download file - STREAM FROM GRIDFS
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

    if (!file.gridFSId) {
      return res.status(500).json({
        success: false,
        message: 'File data not found'
      });
    }

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalName}"`
    });

    // Stream from GridFS
    const downloadStream = gfsBucket.openDownloadStream(file.gridFSId);
    
    downloadStream.on('error', (error) => {
      console.error('Download stream error:', error);
      res.status(404).json({
        success: false,
        message: 'File not found in storage'
      });
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file'
    });
  }
};

// Delete file - DELETE FROM GRIDFS
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

    // Delete from GridFS
    if (file.gridFSId) {
      try {
        await gfsBucket.delete(file.gridFSId);
      } catch (error) {
        console.error('GridFS delete error:', error);
        // Continue to delete database record even if GridFS delete fails
      }
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