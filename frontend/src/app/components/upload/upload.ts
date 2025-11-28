import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FileService } from '../../services/file.service';
import { ToastService } from '../../services/toast.service';

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
  keepPermanently?: boolean;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './upload.html',
  styleUrls: ['./upload.css']
})
export class UploadComponent {
  uploadingFiles: UploadingFile[] = [];
  isDragging = false;
  keepPermanently = false; // Checkbox state

  acceptedTypes = {
    document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.txt', '.md', '.markdown', '.html', '.htm', '.css', '.csv',
      '.rtf', '.odt', '.ods', '.epub', '.xml', '.json'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', 
      '.heic', '.heif', '.ico', '.icon'],
    audio: ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.webm'],
    video: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpeg', '.flv']
  };

  private allAcceptedExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.txt', '.md', '.markdown', '.html', '.htm', '.css', '.csv',
    '.rtf', '.odt', '.ods', '.epub', '.xml', '.json',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', 
    '.heic', '.heif', '.ico', '.icon',
    '.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a', '.webm',
    '.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpeg', '.flv'
  ];

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
    const fileName = file.name.toLowerCase();
    return this.allAcceptedExtensions.some(ext => fileName.endsWith(ext));
  }

  uploadFile(file: File): void {
    const uploadingFile: UploadingFile = {
      file,
      progress: 0,
      keepPermanently: this.keepPermanently
    };

    this.uploadingFiles.push(uploadingFile);

    this.fileService.uploadFile(file, this.keepPermanently).subscribe({
      next: (result) => {
        uploadingFile.progress = result.progress;
        
        if (result.file) {
          const keepMsg = this.keepPermanently ? ' (kept permanently)' : ' (will auto-delete in 10 min)';
          this.toastService.success(`${file.name} uploaded successfully${keepMsg}`);
          
          setTimeout(() => {
            this.uploadingFiles = this.uploadingFiles.filter(f => f !== uploadingFile);
          }, 2000);
        }
      },
      error: (error) => {
        uploadingFile.error = error.error?.message || 'Upload failed';
        this.toastService.error(`Failed to upload ${file.name}`);
        
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