// frontend/src/app/components/export/export.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FileService, FileData } from '../../services/file.service';
import { ExportService } from '../../services/export.service';
import { ToastService } from '../../services/toast.service';

interface ConversionJob {
  file: FileData;
  targetFormat: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  error?: string;
  result?: Blob;
}

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './export.html',
  styleUrls: ['./export.css']
})
export class ExportComponent implements OnInit {
  files: FileData[] = [];
  selectedFile: FileData | null = null;
  selectedCategory: 'image' | 'audio' | 'video' | 'document' | null = null;
  targetFormat = '';
  isLoading = false;
  ffmpegAvailable = false;
  
  // Conversion options
  imageQuality = 90;
  audioBitrate = '192k';
  audioSampleRate = 44100;
  videoWidth = 0;
  videoHeight = 0;
  videoBitrate = '1M';
  audioBitrateVideo = '192k';
  videoFps = 30;
  
  // Document editing
  showDocumentEditor = false;
  documentContent = '';
  isLoadingDocument = false;
  originalDocumentContent = '';
  
  // Conversion jobs
  conversionJobs: ConversionJob[] = [];
  
  constructor(
    private fileService: FileService,
    private exportService: ExportService,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    this.loadFiles();
    this.ffmpegAvailable = await this.exportService.checkFFmpegStatus();
    if (this.ffmpegAvailable) {
      console.log('✅ FFmpeg is available on server');
    } else {
      console.warn('⚠️ FFmpeg not available - audio/video conversions limited');
      this.toastService.warning('Audio and video conversions require FFmpeg to be installed on the server');
    }
  }

  loadFiles() {
    this.isLoading = true;
    this.fileService.getFiles().subscribe({
      next: (files) => {
        this.files = files;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error('Failed to load files');
        this.isLoading = false;
      }
    });
  }

  selectFile(file: FileData) {
    this.selectedFile = file;
    this.selectedCategory = file.fileType as any;
    this.targetFormat = '';
    this.showDocumentEditor = false;
    this.documentContent = '';
    this.originalDocumentContent = '';
    
    if (file.fileType === 'document') {
      this.loadDocumentForEditing();
    }
  }

  async loadDocumentForEditing() {
    if (!this.selectedFile) return;
    
    this.isLoadingDocument = true;
    this.showDocumentEditor = true;
    
    try {
      this.documentContent = await this.exportService.extractEditableText(this.selectedFile);
      this.originalDocumentContent = this.documentContent;
      this.toastService.success('Document loaded for editing');
    } catch (error: any) {
      this.toastService.error('Failed to load document: ' + (error.message || 'Unknown error'));
      this.showDocumentEditor = false;
    } finally {
      this.isLoadingDocument = false;
    }
  }

  resetDocumentContent() {
    this.documentContent = this.originalDocumentContent;
    this.toastService.info('Document content reset');
  }

  getAvailableFormats(): string[] {
    if (!this.selectedCategory) return [];
    
    switch (this.selectedCategory) {
      case 'image':
        return ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'ico'];
      case 'audio':
        return ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];
      case 'video':
        return ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'mp3']; // mp3 for audio extraction
      case 'document':
        return ['txt', 'html', 'md', 'csv', 'json', 'xml', 'docx', 'rtf', 'odt'];
      default:
        return [];
    }
  }

  async startConversion() {
    if (!this.selectedFile || !this.targetFormat) {
      this.toastService.error('Please select a file and target format');
      return;
    }

    // Check if FFmpeg is needed but not available
    if (!this.ffmpegAvailable) {
      if (this.selectedCategory === 'audio') {
        this.toastService.error('Audio conversion requires FFmpeg on the server');
        return;
      }
      if (this.selectedCategory === 'video') {
        this.toastService.error('Video conversion requires FFmpeg on the server');
        return;
      }
      if (this.selectedCategory === 'image' && this.targetFormat === 'gif') {
        this.toastService.error('GIF conversion requires FFmpeg on the server');
        return;
      }
    }

    console.log('Starting conversion:', {
      file: this.selectedFile.filename,
      category: this.selectedCategory,
      format: this.targetFormat
    });

    const job: ConversionJob = {
      file: this.selectedFile,
      targetFormat: this.targetFormat,
      status: 'processing',
      progress: 0
    };

    this.conversionJobs.unshift(job);

    try {
      let result: Blob;
      
      if (this.selectedCategory === 'image') {
        console.log('Converting image...');
        result = await this.exportService.convertImage(
          this.selectedFile,
          this.targetFormat,
          this.imageQuality / 100
        );
      } else if (this.selectedCategory === 'audio') {
        console.log('Converting audio...');
        result = await this.exportService.convertAudio(
          this.selectedFile,
          this.targetFormat,
          this.audioBitrate
        );
      } else if (this.selectedCategory === 'video') {
        console.log('Converting video...');
        if (this.targetFormat === 'mp3') {
          result = await this.exportService.extractAudio(this.selectedFile, 'mp3');
        } else {
          result = await this.exportService.convertVideo(
            this.selectedFile,
            this.targetFormat,
            {
              width: this.videoWidth || undefined,
              height: this.videoHeight || undefined,
              bitrate: this.videoBitrate,
              fps: this.videoFps || undefined
            }
          );
        }
      } else if (this.selectedCategory === 'document') {
        console.log('Converting document with content length:', this.documentContent?.length || 0);
        result = await this.exportService.convertDocument(
          this.selectedFile,
          this.targetFormat,
          this.documentContent || undefined
        );
      } else {
        throw new Error('Unsupported file type');
      }

      job.status = 'complete';
      job.progress = 100;
      job.result = result;
      
      const newFilename = this.getConvertedFilename(this.selectedFile.filename, this.targetFormat);
      console.log('Downloading converted file:', newFilename);
      this.exportService.downloadConvertedFile(result, newFilename);
      
      this.toastService.success(`Converted to ${this.targetFormat.toUpperCase()} successfully!`);
    } catch (error: any) {
      console.error('Conversion error:', error);
      job.status = 'error';
      job.error = error.message || 'Conversion failed';
      this.toastService.error('Conversion failed: ' + job.error);
    }
  }

  getConvertedFilename(originalFilename: string, targetFormat: string): string {
    const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
    return `${baseName}_converted.${targetFormat}`;
  }

  removeJob(job: ConversionJob) {
    this.conversionJobs = this.conversionJobs.filter(j => j !== job);
  }

  getFilesByType(type: 'image' | 'audio' | 'video' | 'document'): FileData[] {
    return this.files.filter(f => f.fileType === type);
  }

  formatFileSize(bytes: number): string {
    return this.fileService.formatFileSize(bytes);
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'image': return 'fa-file-image';
      case 'audio': return 'fa-file-audio';
      case 'video': return 'fa-file-video';
      case 'document': return 'fa-file-lines';
      default: return 'fa-file';
    }
  }

  getFormatIcon(format: string): string {
    if (this.exportService.imageFormats.includes(format)) return '🖼️';
    if (this.exportService.audioFormats.includes(format)) return '🎵';
    if (this.exportService.videoFormats.includes(format)) return '🎬';
    if (this.exportService.documentFormats.includes(format)) return '📄';
    return '📁';
  }

  getWordCount(): number {
    if (!this.documentContent) return 0;
    return this.documentContent.trim().split(/\s+/).length;
  }

  getCharacterCount(): number {
    return this.documentContent.length;
  }

  getLineCount(): number {
    if (!this.documentContent) return 0;
    return this.documentContent.split('\n').length;
  }
  
  // Check if audio/video format needs server-side processing
  needsServerProcessing(): boolean {
    if (!this.selectedCategory || !this.targetFormat) return false;
    
    if (this.selectedCategory === 'audio') return true;
    if (this.selectedCategory === 'video') return true;
    if (this.selectedCategory === 'image' && this.targetFormat === 'gif') return true;
    
    return false;
  }
}