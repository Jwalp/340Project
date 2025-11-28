import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FileService, FileData } from '../../services/file.service';
import { ToastService } from '../../services/toast.service';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl, SafeResourceUrl } from '@angular/platform-browser';

declare var odf: any;
declare var ePub: any;

@Component({
  selector: 'app-my-files',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './my-files.html',
  styleUrls: ['./my-files.css']
})
export class MyFilesComponent implements OnInit, OnDestroy {
  @ViewChild('odfContainer') odfContainer!: ElementRef;
  @ViewChild('epubContainer') epubContainer!: ElementRef;
  
  files: FileData[] = [];
  filteredFiles: FileData[] = [];
  isLoading = true;
  selectedCategory: 'all' | 'document' | 'image' | 'audio' | 'video' = 'all';
  searchQuery = '';
  private timeUpdateInterval: any;
  private odfCanvas: any = null;
  private epubRendition: any = null;
  private scriptsLoaded = {
    webodf: false,
    epub: false
  };
  
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
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml'
  ];

  // OpenDocument formats
  private openDocumentFormats = [
    'application/vnd.oasis.opendocument.text', // ODT
    'application/vnd.oasis.opendocument.spreadsheet', // ODS
    'application/vnd.oasis.opendocument.presentation', // ODP
  ];

  // DOCX formats
  private docxFormats = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  ];

  // Excel formats
  private xlsxFormats = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    'application/vnd.ms-excel', // XLS
  ];

  // EPUB formats
  private epubFormats = [
    'application/epub+zip', // EPUB
  ];

  // Formats that need download (old DOC, RTF, etc.)
  private microsoftOfficeFormats = [
    'application/msword', // DOC (old format)
    'application/rtf', // RTF
  ];

  // All office formats combined
  private officeFormats = [
    ...this.openDocumentFormats,
    ...this.docxFormats,
    ...this.xlsxFormats,
    ...this.epubFormats,
    ...this.microsoftOfficeFormats
  ];

  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.loadFiles();
    this.loadExternalScripts();
    // Update time remaining every second for temporary files
    this.timeUpdateInterval = setInterval(() => {
      this.updateTimeRemaining();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
    // Clean up ODF canvas
    if (this.odfCanvas) {
      try {
        this.odfCanvas.destroy();
      } catch (e) {}
      this.odfCanvas = null;
    }
    // Clean up EPUB rendition
    if (this.epubRendition) {
      try {
        this.epubRendition.destroy();
      } catch (e) {}
      this.epubRendition = null;
    }
    this.cleanupUrls();
  }

  loadExternalScripts() {
    // Load WebODF for ODT/ODS/ODP
    if (!this.scriptsLoaded.webodf && typeof odf === 'undefined') {
      const webodfScript = document.createElement('script');
      webodfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/webodf/0.5.10/webodf.js';
      webodfScript.onload = () => { this.scriptsLoaded.webodf = true; };
      document.head.appendChild(webodfScript);
    }

    // Load Epub.js for EPUB
    if (!this.scriptsLoaded.epub && typeof ePub === 'undefined') {
      const epubScript = document.createElement('script');
      epubScript.src = 'https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js';
      epubScript.onload = () => { this.scriptsLoaded.epub = true; };
      document.head.appendChild(epubScript);
    }
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
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(f => f.fileType === this.selectedCategory);
    }
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(f => f.filename.toLowerCase().includes(query));
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
        const index = this.files.findIndex(f => f.id === file.id);
        if (index !== -1) this.files[index] = updatedFile;
        const filteredIndex = this.filteredFiles.findIndex(f => f.id === file.id);
        if (filteredIndex !== -1) this.filteredFiles[filteredIndex] = updatedFile;
        const statusMsg = newStatus ? 'File will be kept permanently' : 'File will auto-delete in 10 minutes';
        this.toastService.success(statusMsg);
      },
      error: () => this.toastService.error('Failed to update file status')
    });
  }

  viewFile(file: FileData) {
    this.viewingFile = file;
    this.isLoadingPreview = true;
    this.documentError = null;
    this.showOfficeDocDownload = false;
    this.cleanupUrls();
    
    if (file.fileType === 'image' || file.fileType === 'audio' || file.fileType === 'video') {
      this.fileService.downloadFile(file.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.fileUrl = this.sanitizer.bypassSecurityTrustUrl(url);
          this.isLoadingPreview = false;
        },
        error: () => {
          this.toastService.error('Failed to load file preview');
          this.isLoadingPreview = false;
          this.closeViewer();
        }
      });
    } else if (file.fileType === 'document') {
      this.handleDocumentPreview(file);
    }
  }

  handleDocumentPreview(file: FileData) {
    if (file.mimeType === 'application/pdf') {
      this.fileService.downloadFile(file.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoadingPreview = false;
        },
        error: () => {
          this.documentError = 'Failed to load PDF preview';
          this.isLoadingPreview = false;
        }
      });
    } 
    else if (this.docxFormats.includes(file.mimeType) || this.xlsxFormats.includes(file.mimeType)) {
      // Show download prompt for Microsoft Office files
      this.showOfficeDocDownload = true;
      this.isLoadingPreview = false;
    }
    else if (this.epubFormats.includes(file.mimeType)) {
      this.fileService.downloadFile(file.id).subscribe({
        next: (blob) => this.renderEpubDocument(blob),
        error: () => {
          this.documentError = 'Failed to load ebook preview';
          this.isLoadingPreview = false;
        }
      });
    }
    else if (this.openDocumentFormats.includes(file.mimeType)) {
      this.fileService.downloadFile(file.id).subscribe({
        next: (blob) => this.renderODFDocument(blob),
        error: () => {
          this.documentError = 'Failed to load document preview';
          this.isLoadingPreview = false;
        }
      });
    }
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
        error: () => {
          this.documentError = 'Failed to load file preview';
          this.isLoadingPreview = false;
        }
      });
    }
    else if (file.mimeType === 'text/html') {
      this.fileService.downloadFile(file.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoadingPreview = false;
        },
        error: () => {
          this.documentError = 'Failed to load HTML preview';
          this.isLoadingPreview = false;
        }
      });
    }
    else if (this.microsoftOfficeFormats.includes(file.mimeType)) {
      this.showOfficeDocDownload = true;
      this.isLoadingPreview = false;
    }
    else {
      this.isLoadingPreview = false;
    }
  }

  renderEpubDocument(blob: Blob) {
    const checkEpub = () => {
      if (typeof ePub !== 'undefined' && this.epubContainer) {
        try {
          const url = URL.createObjectURL(blob);
          const book = ePub(url);
          const container = this.epubContainer.nativeElement;
          container.innerHTML = '';
          
          this.epubRendition = book.renderTo(container, {
            width: '100%',
            height: '100%',
            flow: 'paginated'
          });
          
          this.epubRendition.display().then(() => {
            this.isLoadingPreview = false;
          }).catch(() => {
            this.documentError = 'Failed to display ebook';
            this.isLoadingPreview = false;
          });
        } catch (error) {
          this.documentError = 'Failed to render ebook';
          this.isLoadingPreview = false;
        }
      } else {
        setTimeout(checkEpub, 100);
      }
    };
    checkEpub();
  }

  renderODFDocument(blob: Blob) {
    const checkWebODF = () => {
      if (typeof odf !== 'undefined' && this.odfContainer) {
        try {
          const container = this.odfContainer.nativeElement;
          container.innerHTML = '';
          const odfCanvas = new odf.OdfCanvas(container);
          this.odfCanvas = odfCanvas;
          const reader = new FileReader();
          reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (arrayBuffer) {
              try {
                odfCanvas.load(new Uint8Array(arrayBuffer));
                this.isLoadingPreview = false;
              } catch (error) {
                this.documentError = 'Failed to render OpenDocument file';
                this.isLoadingPreview = false;
              }
            }
          };
          reader.onerror = () => {
            this.documentError = 'Failed to read document file';
            this.isLoadingPreview = false;
          };
          reader.readAsArrayBuffer(blob);
        } catch (error) {
          this.documentError = 'Failed to initialize document viewer';
          this.isLoadingPreview = false;
        }
      } else {
        setTimeout(checkWebODF, 100);
      }
    };
    checkWebODF();
  }

  closeViewer() {
    if (this.odfCanvas) {
      try { this.odfCanvas.destroy(); } catch (e) {}
      this.odfCanvas = null;
    }
    if (this.epubRendition) {
      try { this.epubRendition.destroy(); } catch (e) {}
      this.epubRendition = null;
    }
    this.cleanupUrls();
    this.viewingFile = null;
    this.isLoadingPreview = false;
    this.documentError = null;
    this.showOfficeDocDownload = false;
  }

  canPreviewDocument(file: FileData): boolean {
    if (file.fileType !== 'document') return false;
    return file.mimeType === 'application/pdf' || 
           file.mimeType === 'text/html' ||
           this.epubFormats.includes(file.mimeType) ||
           this.openDocumentFormats.includes(file.mimeType) ||
           this.textFormats.includes(file.mimeType);
  }

  isTextDocument(file: FileData): boolean { return this.textFormats.includes(file.mimeType); }
  isPDF(file: FileData): boolean { return file.mimeType === 'application/pdf'; }
  isHTMLDocument(file: FileData): boolean { return file.mimeType === 'text/html'; }
  isOfficeDocument(file: FileData): boolean { return this.officeFormats.includes(file.mimeType); }
  isOpenDocument(file: FileData): boolean { return this.openDocumentFormats.includes(file.mimeType); }
  isDocxDocument(file: FileData): boolean { return this.docxFormats.includes(file.mimeType); }
  isXlsxDocument(file: FileData): boolean { return this.xlsxFormats.includes(file.mimeType); }
  isEpubDocument(file: FileData): boolean { return this.epubFormats.includes(file.mimeType); }
  isMicrosoftOffice(file: FileData): boolean { return this.microsoftOfficeFormats.includes(file.mimeType); }

  getOfficeDocumentType(file: FileData): string {
    const mimeType = file.mimeType;
    if (mimeType.includes('word') || mimeType.includes('document') || mimeType === 'application/msword') return 'Word Document';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Excel Spreadsheet';
    if (mimeType.includes('rtf')) return 'Rich Text Document';
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
      error: () => this.toastService.error('Failed to download file')
    });
  }

  deleteFile(file: FileData) {
    if (confirm(`Are you sure you want to delete ${file.filename}?`)) {
      this.fileService.deleteFile(file.id).subscribe({
        next: () => {
          this.toastService.success(`${file.filename} deleted successfully`);
          this.loadFiles();
        },
        error: () => this.toastService.error('Failed to delete file')
      });
    }
  }

  getFileIcon(fileType: string): string {
    switch (fileType) {
      case 'document': return 'fa-file-lines';
      case 'image': return 'fa-file-image';
      case 'audio': return 'fa-file-audio';
      case 'video': return 'fa-file-video';
      default: return 'fa-file';
    }
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'document': return '📄';
      case 'image': return '🖼️';
      case 'audio': return '🎵';
      case 'video': return '🎬';
      default: return '📁';
    }
  }

  formatFileSize(bytes: number): string { return this.fileService.formatFileSize(bytes); }
  
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  getFilesByCategory(category: string): FileData[] { return this.files.filter(f => f.fileType === category); }
  getTimeRemaining(purgeAt: string | null | undefined): string { return this.fileService.getTimeRemaining(purgeAt || null); }
  
  updateTimeRemaining() {
    this.filteredFiles = [...this.filteredFiles];
  }

  getSupportedFormatsText(): string {
    return 'Inline preview available for: PDF, EPUB, ODT, ODS, ODP, TXT, MD, HTML, CSS, JSON, XML, CSV. Download required for: DOCX, XLSX, DOC, XLS, RTF.';
  }
}