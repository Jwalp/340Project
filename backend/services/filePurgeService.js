// backend/services/filePurgeService.js - Automatic file deletion service
const File = require('../models/File');
const mongoose = require('mongoose');

// ⭐ CONFIGURATION - ADJUST THESE VALUES
const PURGE_CHECK_INTERVAL = 1 * 60 * 1000; // Check every 1 minute (in milliseconds)
const DEFAULT_PURGE_MINUTES = 10; // Default time before purging (in minutes)

class FilePurgeService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.gfsBucket = null;
  }

  // Initialize GridFS bucket
  initGridFS() {
    if (!this.gfsBucket && mongoose.connection.db) {
      this.gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
      });
      console.log('📁 FilePurgeService: GridFS bucket initialized');
    }
  }

  // Start the purge service
  start() {
    if (this.isRunning) {
      console.log('⚠️ FilePurgeService: Already running');
      return;
    }

    console.log(`🚀 FilePurgeService: Starting (checks every ${PURGE_CHECK_INTERVAL / 60000} minutes)`);
    console.log(`⏰ Default purge time: ${DEFAULT_PURGE_MINUTES} minutes after upload`);
    
    this.isRunning = true;
    
    // Initialize GridFS
    this.initGridFS();
    
    // Run immediately on start
    this.purgeExpiredFiles();
    
    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.purgeExpiredFiles();
    }, PURGE_CHECK_INTERVAL);
  }

  // Stop the purge service
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('🛑 FilePurgeService: Stopped');
    }
  }

  // Main purge function
  async purgeExpiredFiles() {
    try {
      const now = new Date();
      
      // Find files that should be purged:
      // 1. purgeAt date has passed
      // 2. keepPermanently is false
      const filesToPurge = await File.find({
        purgeAt: { $lte: now },
        keepPermanently: false
      });

      if (filesToPurge.length === 0) {
        console.log(`✅ FilePurgeService: No files to purge at ${now.toISOString()}`);
        return;
      }

      console.log(`🗑️ FilePurgeService: Found ${filesToPurge.length} files to purge`);

      let successCount = 0;
      let errorCount = 0;

      for (const file of filesToPurge) {
        try {
          // Delete from GridFS if exists
          if (file.gridFSId && this.gfsBucket) {
            try {
              await this.gfsBucket.delete(file.gridFSId);
              console.log(`  ✓ Deleted from GridFS: ${file.originalName}`);
            } catch (gridError) {
              console.error(`  ✗ GridFS delete error for ${file.originalName}:`, gridError.message);
            }
          }

          // Delete from database
          await File.findByIdAndDelete(file._id);
          console.log(`  ✓ Purged: ${file.originalName} (uploaded: ${file.uploadDate.toISOString()})`);
          successCount++;

        } catch (error) {
          console.error(`  ✗ Error purging ${file.originalName}:`, error.message);
          errorCount++;
        }
      }

      console.log(`📊 FilePurgeService: Purge complete - Success: ${successCount}, Errors: ${errorCount}`);

    } catch (error) {
      console.error('❌ FilePurgeService: Error during purge:', error);
    }
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: PURGE_CHECK_INTERVAL,
      defaultPurgeMinutes: DEFAULT_PURGE_MINUTES,
      nextCheckIn: this.isRunning ? PURGE_CHECK_INTERVAL : null
    };
  }
}

// Export singleton instance
module.exports = new FilePurgeService();