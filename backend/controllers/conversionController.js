// backend/controllers/conversionController.js
const File = require('../models/File');
const mongoose = require('mongoose');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execPromise = promisify(exec);

// Get GridFS bucket
let gfsBucket;
mongoose.connection.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

// Check if FFmpeg is installed
async function checkFFmpeg() {
  try {
    await execPromise('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}

// Convert media file
exports.convertMedia = async (req, res) => {
  const tempDir = path.join(os.tmpdir(), 'fileverse-conversions');
  let inputPath = null;
  let outputPath = null;

  try {
    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    const { fileId, targetFormat, options = {} } = req.body;
    const userId = req.user.id;

    // Check FFmpeg availability
    const hasFFmpeg = await checkFFmpeg();
    if (!hasFFmpeg) {
      return res.status(503).json({
        success: false,
        message: 'FFmpeg is not installed on the server. Please install FFmpeg to enable media conversion.'
      });
    }

    // Get file from database
    const file = await File.findOne({ _id: fileId, userId });
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Create temp file paths
    const timestamp = Date.now();
    const inputExt = path.extname(file.originalName);
    inputPath = path.join(tempDir, `input_${timestamp}${inputExt}`);
    outputPath = path.join(tempDir, `output_${timestamp}.${targetFormat}`);

    console.log(`🔄 Converting ${file.originalName} to ${targetFormat}`);

    // Download file from GridFS to temp location
    const downloadStream = gfsBucket.openDownloadStream(file.gridFSId);
    const writeStream = require('fs').createWriteStream(inputPath);
    
    await new Promise((resolve, reject) => {
      downloadStream
        .pipe(writeStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    // Build FFmpeg command based on file type
    let command;
    if (file.fileType === 'image') {
      command = buildImageCommand(inputPath, outputPath, targetFormat, options);
    } else if (file.fileType === 'audio') {
      command = buildAudioCommand(inputPath, outputPath, targetFormat, options);
    } else if (file.fileType === 'video') {
      if (['mp3', 'wav', 'ogg'].includes(targetFormat)) {
        command = buildAudioExtractionCommand(inputPath, outputPath, targetFormat, options);
      } else {
        command = buildVideoCommand(inputPath, outputPath, targetFormat, options);
      }
    } else {
      throw new Error('Unsupported file type for conversion');
    }

    console.log(`⚙️  Executing: ${command}`);

    // Execute FFmpeg command
    await execPromise(command, { 
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer
      timeout: 300000 // 5 minute timeout
    });

    // Read converted file
    const convertedData = await fs.readFile(outputPath);
    const newFilename = `${path.parse(file.originalName).name}_converted.${targetFormat}`;

    // Send file to client
    res.set({
      'Content-Type': getMimeType(targetFormat),
      'Content-Disposition': `attachment; filename="${newFilename}"`
    });
    res.send(convertedData);

    console.log(`✅ Conversion complete: ${newFilename}`);

  } catch (error) {
    console.error('❌ Conversion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Conversion failed'
    });
  } finally {
    // Cleanup temp files
    try {
      if (inputPath) await fs.unlink(inputPath).catch(() => {});
      if (outputPath) await fs.unlink(outputPath).catch(() => {});
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
};

// Build FFmpeg command for images
function buildImageCommand(inputPath, outputPath, targetFormat, options) {
  const quality = options.quality || 90;
  
  if (targetFormat === 'gif') {
    // Special GIF handling with palette
    const palettePath = outputPath.replace('.gif', '_palette.png');
    return `ffmpeg -i "${inputPath}" -vf "fps=10,scale=320:-1:flags=lanczos,palettegen" -y "${palettePath}" && ffmpeg -i "${inputPath}" -i "${palettePath}" -filter_complex "fps=10,scale=320:-1:flags=lanczos[x];[x][1:v]paletteuse" -y "${outputPath}" && rm "${palettePath}"`;
  }

  let cmd = `ffmpeg -i "${inputPath}"`;
  
  switch (targetFormat) {
    case 'jpg':
    case 'jpeg':
      cmd += ` -q:v ${Math.round((100 - quality) / 10)}`;
      break;
    case 'png':
      cmd += ` -compression_level 9`;
      break;
    case 'webp':
      cmd += ` -quality ${quality}`;
      break;
  }
  
  cmd += ` -y "${outputPath}"`;
  return cmd;
}

// Build FFmpeg command for audio
function buildAudioCommand(inputPath, outputPath, targetFormat, options) {
  const bitrate = options.bitrate || '192k';
  const sampleRate = options.sampleRate || 44100;
  
  let cmd = `ffmpeg -i "${inputPath}"`;
  
  switch (targetFormat) {
    case 'mp3':
      cmd += ` -codec:a libmp3lame -b:a ${bitrate} -ar ${sampleRate}`;
      break;
    case 'wav':
      cmd += ` -codec:a pcm_s16le -ar ${sampleRate}`;
      break;
    case 'ogg':
      cmd += ` -codec:a libvorbis -b:a ${bitrate} -ar ${sampleRate}`;
      break;
    case 'aac':
      cmd += ` -codec:a aac -b:a ${bitrate} -ar ${sampleRate}`;
      break;
    case 'flac':
      cmd += ` -codec:a flac -ar ${sampleRate}`;
      break;
    case 'm4a':
      cmd += ` -codec:a aac -b:a ${bitrate} -ar ${sampleRate}`;
      break;
  }
  
  cmd += ` -y "${outputPath}"`;
  return cmd;
}

// Build FFmpeg command for audio extraction from video
function buildAudioExtractionCommand(inputPath, outputPath, targetFormat, options) {
  const bitrate = options.bitrate || '192k';
  
  let cmd = `ffmpeg -i "${inputPath}" -vn`;
  
  switch (targetFormat) {
    case 'mp3':
      cmd += ` -codec:a libmp3lame -b:a ${bitrate}`;
      break;
    case 'wav':
      cmd += ` -codec:a pcm_s16le`;
      break;
    case 'ogg':
      cmd += ` -codec:a libvorbis -b:a ${bitrate}`;
      break;
  }
  
  cmd += ` -y "${outputPath}"`;
  return cmd;
}

// Build FFmpeg command for video
function buildVideoCommand(inputPath, outputPath, targetFormat, options) {
  const videoBitrate = options.videoBitrate || '1M';
  const audioBitrate = options.audioBitrate || '192k';
  const width = options.width;
  const height = options.height;
  const fps = options.fps;
  
  let cmd = `ffmpeg -i "${inputPath}"`;
  
  // Video codec based on format
  switch (targetFormat) {
    case 'mp4':
      cmd += ` -codec:v libx264 -preset medium -b:v ${videoBitrate} -codec:a aac -b:a ${audioBitrate}`;
      break;
    case 'webm':
      cmd += ` -codec:v libvpx-vp9 -b:v ${videoBitrate} -codec:a libopus -b:a ${audioBitrate}`;
      break;
    case 'avi':
      cmd += ` -codec:v libx264 -b:v ${videoBitrate} -codec:a mp3 -b:a ${audioBitrate}`;
      break;
    case 'mkv':
      cmd += ` -codec:v libx264 -b:v ${videoBitrate} -codec:a aac -b:a ${audioBitrate}`;
      break;
    case 'mov':
      cmd += ` -codec:v libx264 -b:v ${videoBitrate} -codec:a aac -b:a ${audioBitrate}`;
      break;
    case 'flv':
      cmd += ` -codec:v libx264 -b:v ${videoBitrate} -codec:a aac -b:a ${audioBitrate}`;
      break;
  }
  
  // Add resolution filter if specified
  if (width && height) {
    cmd += ` -vf "scale=${width}:${height}"`;
  } else if (width) {
    cmd += ` -vf "scale=${width}:-2"`;
  } else if (height) {
    cmd += ` -vf "scale=-2:${height}"`;
  }
  
  // Add FPS if specified
  if (fps) {
    cmd += ` -r ${fps}`;
  }
  
  cmd += ` -y "${outputPath}"`;
  return cmd;
}

// Get MIME type for format
function getMimeType(format) {
  const mimeTypes = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    flv: 'video/x-flv'
  };
  return mimeTypes[format] || 'application/octet-stream';
}

// Check FFmpeg status endpoint
exports.checkFFmpegStatus = async (req, res) => {
  try {
    const hasFFmpeg = await checkFFmpeg();
    
    if (hasFFmpeg) {
      const { stdout } = await execPromise('ffmpeg -version');
      const versionLine = stdout.split('\n')[0];
      
      res.json({
        success: true,
        available: true,
        version: versionLine,
        message: 'FFmpeg is installed and ready'
      });
    } else {
      res.json({
        success: true,
        available: false,
        message: 'FFmpeg is not installed'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check FFmpeg status',
      error: error.message
    });
  }
};