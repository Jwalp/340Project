// frontend/src/app/components/my-files/my-files.ts - With Universal Document Preview
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FileService, FileData } from '../../services/file.service';
import { ToastService } from '../../services/toast.service';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-my-files',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './my-files.html',
  styleUrls: ['./my-files.css']
})
export class MyFilesComponent implements OnInit, OnDestroy {
  files: FileData[] = [];
  filteredFiles: FileData[] = [];
  isLoading = true;
  selectedCategory: 'all' | 'document' | 'image' | 'audio' | 'video' = 'all';
  searchQuery = '';
  private timeUpdateInterval: any;
  
  // Viewer properties
  viewingFile: FileData | null = null;
  fileUrl: SafeUrl | null = null;
  viewerUrl: SafeResourceUrl | null = null;
  textContent: string | null = null;
  isLoadingPreview = false;
  documentError: string | null = null;
  showOfficeDocDownload = false;

  // Supported formats
  private textFormats = [
    'text/plain',
    'text/markdown',
    'text/css',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml'
  ];

  // Office document formats - will show download with preview info
  private officeFormats = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/msword', // DOC
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    'application/vnd.ms-excel', // XLS
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
    'application/vnd.ms-powerpoint', // PPT
    'application/vnd.oasis.opendocument.text', // ODT
    'application/vnd.oasis.opendocument.spreadsheet', // ODS
    'application/vnd.oasis.opendocument.presentation', // ODP
    'application/rtf', // RTF
  ];

  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.loadFiles();
    // Update time remaining every second for temporary files
    this.timeUpdateInterval = setInterval(() => {
      this.updateTimeRemaining();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
    // Clean up blob URL when component is destroyed
    this.cleanupUrls();
  }

  cleanupUrls() {
    if (this.fileUrl && typeof this.fileUrl === 'string') {
      URL.revokeObjectURL(this.fileUrl);
    }
    if (this.viewerUrl && typeof this.viewerUrl === 'string') {
      URL.revokeObjectURL(this.viewerUrl.toString());
    }
    this.fileUrl = null;
    this.viewerUrl = null;
    this.textContent = null;
    this.documentError = null;
    this.showOfficeDocDownload = false;
  }

  loadFiles() {
    this.isLoading = true;
    this.fileService.getFiles().subscribe({
      next: (files) => {
        this.files = files;
        this.filterFiles();
        this.isLoading = false;
      },
      error: (error) => {
        this.toastService.error('Failed to load files');
        this.isLoading = false;
      }
    });
  }

  filterFiles() {
    let filtered = this.files;

    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(f => f.fileType === this.selectedCategory);
    }

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        f.filename.toLowerCase().includes(query)
      );
    }

    this.filteredFiles = filtered;
  }

  selectCategory(category: 'all' | 'document' | 'image' | 'audio' | 'video') {
    this.selectedCategory = category;
    this.filterFiles();
  }

  onSearchChange(event: any) {
    this.searchQuery = event.target.value;
    this.filterFiles();
  }

  toggleKeepStatus(file: FileData) {
    const newStatus = !file.keepPermanently;
    
    this.fileService.updateKeepStatus(file.id, newStatus).subscribe({
      next: (updatedFile) => {
        // Update the file in our local array
        const index = this.files.findIndex(f => f.id === file.id);
        if (index !== -1) {
          this.files[index] = updatedFile;
        }
        
        // Update filtered files
        const filteredIndex = this.filteredFiles.findIndex(f => f.id === file.id);
        if (filteredIndex !== -1) {
          this.filteredFiles[filteredIndex] = updatedFile;
        }
        
        const statusMsg = newStatus 
          ? 'File will be kept permanently' 
          : 'File will auto-delete in 10 minutes';
        this.toastService.success(statusMsg);
      },
      error: (error) => {
        this.toastService.error('Failed to update file status');
      }
    });
  }

  viewFile(file: FileData) {
    this.viewingFile = file;
    this.isLoadingPreview = true;
    this.documentError = null;
    this.showOfficeDocDownload = false;
    this.cleanupUrls();
    
    // Handle different file types
    if (file.fileType === 'image' || file.fileType === 'audio' || file.fileType === 'video') {
      // Media files - create blob URL
      this.fileService.downloadFile(file.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.fileUrl = this.sanitizer.bypassSecurityTrustUrl(url);
          this.isLoadingPreview = false;
        },
        error: (error) => {
          this.toastService.error('Failed to load file preview');
          this.isLoadingPreview = false;
          this.closeViewer();
        }
      });
    } else if (file.fileType === 'document') {
      // Document files - check type
      this.handleDocumentPreview(file);
    }
  }

  handleDocumentPreview(file: FileData) {
    // Check if it's a PDF
    if (file.mimeType === 'application/pdf') {
      this.fileService.downloadFile(file.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoadingPreview = false;
        },
        error: (error) => {
          this.documentError = 'Failed to load PDF preview';
          this.isLoadingPreview = false;
        }
      });
    } 
    // Check if it's an Office document or OpenDocument format
    else if (this.officeFormats.includes(file.mimeType)) {
      // Office documents - show download option since browser preview isn't reliable
      this.showOfficeDocDownload = true;
      this.isLoadingPreview = false;
    }
    // Check if it's a text-based format
    else if (this.textFormats.includes(file.mimeType)) {
      this.fileService.downloadFile(file.id).subscribe({
        next: (blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            this.textContent = reader.result as string;
            this.isLoadingPreview = false;
          };
          reader.onerror = () => {
            this.documentError = 'Failed to read file content';
            this.isLoadingPreview = false;
          };
          reader.readAsText(blob);
        },
        error: (error) => {
          this.documentError = 'Failed to load file preview';
          this.isLoadingPreview = false;
        }
      });
    }
    // Check if it's HTML
    else if (file.mimeType === 'text/html') {
      this.fileService.downloadFile(file.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoadingPreview = false;
        },
        error: (error) => {
          this.documentError = 'Failed to load HTML preview';
          this.isLoadingPreview = false;
        }
      });
    }
    // Other document types - show download prompt
    else {
      this.isLoadingPreview = false;
    }
  }

  closeViewer() {
    this.cleanupUrls();
    this.viewingFile = null;
    this.isLoadingPreview = false;
    this.documentError = null;
    this.showOfficeDocDownload = false;
  }

  canPreviewDocument(file: FileData): boolean {
    if (file.fileType !== 'document') return false;
    
    // Can preview PDFs, HTML, and text-based files directly
    return file.mimeType === 'application/pdf' || 
           file.mimeType === 'text/html' ||
           this.textFormats.includes(file.mimeType);
  }

  isTextDocument(file: FileData): boolean {
    return this.textFormats.includes(file.mimeType);
  }

  isPDF(file: FileData): boolean {
    return file.mimeType === 'application/pdf';
  }

  isHTMLDocument(file: FileData): boolean {
    return file.mimeType === 'text/html';
  }

  isOfficeDocument(file: FileData): boolean {
    return this.officeFormats.includes(file.mimeType);
  }

  getOfficeDocumentType(file: FileData): string {
    const mimeType = file.mimeType;
    if (mimeType.includes('word') || mimeType.includes('opendocument.text')) {
      return 'Word Document';
    } else if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('opendocument.spreadsheet')) {
      return 'Spreadsheet';
    } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('opendocument.presentation')) {
      return 'Presentation';
    } else if (mimeType.includes('rtf')) {
      return 'Rich Text Document';
    }
    return 'Office Document';
  }

  downloadFile(file: FileData) {
    this.fileService.downloadFile(file.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.filename;
        link.click();
        window.URL.revokeObjectURL(url);
        this.toastService.success(`Downloading ${file.filename}`);
      },
      error: (error) => {
        this.toastService.error('Failed to download file');
      }
    });
  }

  deleteFile(file: FileData) {
    if (confirm(`Are you sure you want to delete ${file.filename}?`)) {
      this.fileService.deleteFile(file.id).subscribe({
        next: () => {
          this.toastService.success(`${file.filename} deleted successfully`);
          this.loadFiles();
        },
        error: (error) => {
          this.toastService.error('Failed to delete file');
        }
      });
    }
  }

  getFileIcon(fileType: string): string {
    switch (fileType) {
      case 'document':
        return 'fa-file-lines';
      case 'image':
        return 'fa-file-image';
      case 'audio':
        return 'fa-file-audio';
      case 'video':
        return 'fa-file-video';
      default:
        return 'fa-file';
    }
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'document':
        return '📄';
      case 'image':
        return '🖼️';
      case 'audio':
        return '🎵';
      case 'video':
        return '🎬';
      default:
        return '📁';
    }
  }

  formatFileSize(bytes: number): string {
    return this.fileService.formatFileSize(bytes);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getFilesByCategory(category: string): FileData[] {
    return this.files.filter(f => f.fileType === category);
  }

  getTimeRemaining(purgeAt: string | null | undefined): string {
    return this.fileService.getTimeRemaining(purgeAt || null);
  }

  updateTimeRemaining() {
    // Force re-render of time remaining for temporary files
    // This is called every second by the interval
    this.filteredFiles = [...this.filteredFiles];
  }

  getSupportedFormatsText(): string {
    return 'PDF, TXT, MD, HTML, CSS, JSON, XML, CSV files can be previewed. Office documents (DOCX, XLSX, PPTX, ODT, ODS, ODP) can be downloaded to view.';
  }
}