// frontend/src/app/components/upload/upload.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FileService } from '../../services/file.service';
import { ToastService } from '../../services/toast.service';

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './upload.html',
  styleUrls: ['./upload.css']
})
export class UploadComponent {
  uploadingFiles: UploadingFile[] = [];
  isDragging = false;

  // Accepted file types
  acceptedTypes = {
    document: [
      // Microsoft Office
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      // Text formats
      '.txt', '.md', '.markdown', '.html', '.htm', '.css', '.csv',
      // Rich Text and OpenDocument
      '.rtf', '.odt', '.ods', '.odp',
      // EPUB and other
      '.epub', '.xml', '.json'
    ],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.heic', '.heif'],
    audio: ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'],
    video: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpeg', '.flv']
  };

  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFileSelect(event: any): void {
    const files = event.target.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
    // Reset input
    event.target.value = '';
  }

  handleFiles(files: File[]): void {
    files.forEach(file => {
      if (this.isValidFileType(file)) {
        this.uploadFile(file);
      } else {
        this.toastService.error(`${file.name} is not a supported file type`);
      }
    });
  }

  isValidFileType(file: File): boolean {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const allAcceptedTypes = [
      ...this.acceptedTypes.document,
      ...this.acceptedTypes.image,
      ...this.acceptedTypes.audio,
      ...this.acceptedTypes.video
    ];
    return allAcceptedTypes.includes(extension);
  }

  uploadFile(file: File): void {
    const uploadingFile: UploadingFile = {
      file,
      progress: 0
    };

    this.uploadingFiles.push(uploadingFile);

    this.fileService.uploadFile(file).subscribe({
      next: (result) => {
        uploadingFile.progress = result.progress;
        
        if (result.file) {
          // Upload complete
          this.toastService.success(`${file.name} uploaded successfully!`);
          // Remove from uploading list after a delay
          setTimeout(() => {
            this.uploadingFiles = this.uploadingFiles.filter(f => f !== uploadingFile);
          }, 2000);
        }
      },
      error: (error) => {
        uploadingFile.error = error.error?.message || 'Upload failed';
        this.toastService.error(`Failed to upload ${file.name}`);
        
        // Remove failed upload after delay
        setTimeout(() => {
          this.uploadingFiles = this.uploadingFiles.filter(f => f !== uploadingFile);
        }, 3000);
      }
    });
  }

  getFileIcon(file: File): string {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (this.acceptedTypes.document.some(t => t.includes(ext!))) {
      return 'fa-file-lines';
    } else if (this.acceptedTypes.image.some(t => t.includes(ext!))) {
      return 'fa-file-image';
    } else if (this.acceptedTypes.audio.some(t => t.includes(ext!))) {
      return 'fa-file-audio';
    } else if (this.acceptedTypes.video.some(t => t.includes(ext!))) {
      return 'fa-file-video';
    }
    return 'fa-file';
  }

  formatFileSize(bytes: number): string {
    return this.fileService.formatFileSize(bytes);
  }

  cancelUpload(uploadingFile: UploadingFile): void {
    this.uploadingFiles = this.uploadingFiles.filter(f => f !== uploadingFile);
  }
}