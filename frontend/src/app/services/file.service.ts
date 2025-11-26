// frontend/src/app/services/file.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { HttpParams } from '@angular/common/http';

export interface FileData {
  id: string;
  filename: string;
  fileType: 'document' | 'image' | 'audio' | 'video';
  mimeType: string;
  size: number;
  uploadDate: string;
}

interface FileResponse {
  success: boolean;
  message?: string;
  file?: FileData;
  files?: FileData[];
  count?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  uploadFile(file: File): Observable<{ progress: number; file?: FileData }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<FileResponse>(
      `${this.apiUrl}/files/upload`,
      formData,
      {
        reportProgress: true,
        observe: 'events'
      }
    ).pipe(
      map((event: HttpEvent<any>) => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total 
            ? Math.round((100 * event.loaded) / event.total)
            : 0;
          return { progress };
        } else if (event.type === HttpEventType.Response) {
          return { 
            progress: 100, 
            file: event.body.file 
          };
        }
        return { progress: 0 };
      })
    );
  }


    getFiles(fileType?: string): Observable<FileData[]> {
    let params = new HttpParams();
    if (fileType) {
        params = params.set('fileType', fileType);  // Add query parameter if fileType is provided
    }

    return this.http.get<FileResponse>(`${this.apiUrl}/files`, { params })
        .pipe(
        map(response => response.files || [])  // Return files or an empty array
    );
    }


  getFileById(id: string): Observable<FileData> {
    return this.http.get<FileResponse>(`${this.apiUrl}/files/${id}`)
      .pipe(map(response => response.file!));
  }

  downloadFile(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/files/${id}/download`, {
      responseType: 'blob'
    });
  }

  deleteFile(id: string): Observable<any> {
    return this.http.delete<FileResponse>(`${this.apiUrl}/files/${id}`);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}