// frontend/src/app/components/my-files/my-files.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FileService, FileData } from '../../services/file.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-my-files',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './my-files.html',
  styleUrls: ['./my-files.css']
})
export class MyFilesComponent implements OnInit {
  files: FileData[] = [];
  filteredFiles: FileData[] = [];
  isLoading = true;
  selectedCategory: 'all' | 'document' | 'image' | 'audio' | 'video' = 'all';
  searchQuery = '';

  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.loadFiles();
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
}