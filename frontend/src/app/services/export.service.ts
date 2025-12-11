// frontend/src/app/services/export.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FileService, FileData } from './file.service';
import { ToastService } from './toast.service';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
    XLSX: any;
  }
}

interface ConversionOptions {
  quality?: number;
  bitrate?: string;
  sampleRate?: number;
  videoBitrate?: string;
  audioBitrate?: string;
  width?: number;
  height?: number;
  fps?: number;
}

interface FFmpegStatusResponse {
  success: boolean;
  available: boolean;
  version?: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private apiUrl = environment.apiUrl;
  
  // Supported conversions
  readonly imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico'];
  readonly audioFormats = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];
  readonly videoFormats = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'];
  readonly documentFormats = ['txt', 'html', 'md', 'csv', 'docx', 'rtf', 'odt', 'xml', 'json'];

  private ffmpegAvailable = false;

  constructor(
    private http: HttpClient,
    private fileService: FileService,
    private toastService: ToastService
  ) {
    this.checkFFmpegStatus();
  }

  async checkFFmpegStatus(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.http.get<FFmpegStatusResponse>(`${this.apiUrl}/conversion/ffmpeg-status`)
      );
      this.ffmpegAvailable = response.available;
      if (response.available) {
        console.log('✅ FFmpeg available on server:', response.version);
      } else {
        console.warn('⚠️ FFmpeg not available on server');
      }
      return this.ffmpegAvailable;
    } catch (error) {
      console.error('Failed to check FFmpeg status:', error);
      this.ffmpegAvailable = false;
      return false;
    }
  }

  isFFmpegReady(): boolean {
    return this.ffmpegAvailable;
  }

  // ==================== IMAGE CONVERSION ====================
  
  async convertImage(
    file: FileData,
    targetFormat: string,
    quality: number = 0.9
  ): Promise<Blob> {
    // For GIF, always use server-side FFmpeg if available
    if (targetFormat === 'gif' && this.ffmpegAvailable) {
      return await this.convertMediaServerSide(file, targetFormat, { quality: Math.round(quality * 100) });
    }
    
    // For other image formats, use Canvas API (client-side)
    const blob = await firstValueFrom(this.fileService.downloadFile(file.id));
    
    if (targetFormat === 'svg') {
      const ext = this.getFileExtension(file.filename);
      if (ext === 'svg') return blob;
      throw new Error('Cannot convert raster images to SVG format');
    }
    
    const sourceExt = this.getFileExtension(file.filename);
    if (sourceExt === 'svg') {
      return await this.convertSVGToRaster(blob, targetFormat, quality);
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');
          
          if (targetFormat === 'jpg' || targetFormat === 'jpeg' || targetFormat === 'bmp') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob(
            (resultBlob) => {
              URL.revokeObjectURL(url);
              if (resultBlob) resolve(resultBlob);
              else reject(new Error('Failed to convert image'));
            },
            this.getMimeType(targetFormat),
            quality
          );
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  }

  private async convertSVGToRaster(blob: Blob, targetFormat: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const svgText = e.target?.result as string;
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width || 800;
          canvas.height = img.height || 600;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          if (targetFormat === 'jpg' || targetFormat === 'jpeg' || targetFormat === 'bmp') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob(
            (resultBlob) => {
              if (resultBlob) resolve(resultBlob);
              else reject(new Error('Failed to convert SVG'));
            },
            this.getMimeType(targetFormat),
            quality
          );
        };
        
        img.onerror = () => reject(new Error('Failed to load SVG'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      };
      
      reader.onerror = () => reject(new Error('Failed to read SVG file'));
      reader.readAsText(blob);
    });
  }

  // ==================== AUDIO CONVERSION ====================
  
  async convertAudio(
    file: FileData,
    targetFormat: string,
    bitrate: string = '192k'
  ): Promise<Blob> {
    if (!this.ffmpegAvailable) {
      throw new Error('Audio conversion requires FFmpeg on the server. Please contact administrator.');
    }
    
    return await this.convertMediaServerSide(file, targetFormat, { 
      bitrate,
      sampleRate: 44100
    });
  }

  // ==================== VIDEO CONVERSION ====================
  
  async convertVideo(
    file: FileData,
    targetFormat: string,
    options?: { width?: number; height?: number; bitrate?: string; fps?: number }
  ): Promise<Blob> {
    if (!this.ffmpegAvailable) {
      throw new Error('Video conversion requires FFmpeg on the server. Please contact administrator.');
    }
    
    return await this.convertMediaServerSide(file, targetFormat, {
      videoBitrate: options?.bitrate || '1M',
      audioBitrate: '192k',
      width: options?.width,
      height: options?.height,
      fps: options?.fps
    });
  }

  async extractAudio(file: FileData, targetFormat: string = 'mp3'): Promise<Blob> {
    if (!this.ffmpegAvailable) {
      throw new Error('Audio extraction requires FFmpeg on the server. Please contact administrator.');
    }
    
    return await this.convertMediaServerSide(file, targetFormat, { 
      bitrate: '192k'
    });
  }

  // ==================== SERVER-SIDE CONVERSION ====================
  
  private async convertMediaServerSide(
    file: FileData,
    targetFormat: string,
    options: ConversionOptions = {}
  ): Promise<Blob> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${this.apiUrl}/conversion/convert`,
          {
            fileId: file.id,
            targetFormat,
            options
          },
          { 
            responseType: 'blob',
            observe: 'response'
          }
        )
      );

      if (response.body) {
        return response.body;
      } else {
        throw new Error('No response body from server');
      }
    } catch (error: any) {
      console.error('Server-side conversion error:', error);
      
      if (error.error instanceof Blob) {
        const text = await error.error.text();
        try {
          const errorObj = JSON.parse(text);
          throw new Error(errorObj.message || 'Conversion failed on server');
        } catch {
          throw new Error('Conversion failed on server');
        }
      }
      
      throw new Error(error.error?.message || error.message || 'Conversion failed');
    }
  }

  // ==================== DOCUMENT EDITING ====================
  
  async extractEditableText(file: FileData): Promise<string> {
    const blob = await firstValueFrom(this.fileService.downloadFile(file.id));
    const mimeType = file.mimeType;
    
    if (mimeType === 'application/pdf') {
      return await this.extractTextFromPDF(blob);
    }
    
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await this.extractTextFromDOCX(blob);
    }
    
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel') {
      return await this.extractTextFromExcel(blob);
    }
    
    if (mimeType === 'text/html') {
      const html = await blob.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body.textContent || doc.body.innerText || '';
    }
    
    if (mimeType.startsWith('text/')) {
      return await blob.text();
    }
    
    if (mimeType === 'text/csv') {
      return await blob.text();
    }
    
    if (mimeType === 'application/json') {
      const json = await blob.text();
      return JSON.stringify(JSON.parse(json), null, 2);
    }
    
    if (mimeType === 'application/xml' || mimeType === 'text/xml') {
      return await blob.text();
    }
    
    try {
      return await blob.text();
    } catch {
      throw new Error('Unable to extract text from this document type');
    }
  }

  private async extractTextFromPDF(blob: Blob): Promise<string> {
    if (!window.pdfjsLib) throw new Error('PDF.js not loaded');

    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      let lastY = -1;
      let pageText = '';
      
      textContent.items.forEach((item: any) => {
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        }
        pageText += item.str;
        
        if (item.hasEOL) {
          pageText += '\n';
        } else {
          pageText += ' ';
        }
        
        lastY = item.transform[5];
      });
      
      fullText += `=== Page ${i} ===\n\n${pageText.trim()}\n\n`;
    }
    
    return fullText.trim();
  }

  private async extractTextFromDOCX(blob: Blob): Promise<string> {
    if (!window.mammoth) throw new Error('Mammoth.js not loaded');

    const arrayBuffer = await blob.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    
    return result.value
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async extractTextFromExcel(blob: Blob): Promise<string> {
    if (!window.XLSX) throw new Error('SheetJS not loaded');

    const arrayBuffer = await blob.arrayBuffer();
    const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
    
    let allText = '';
    
    workbook.SheetNames.forEach((sheetName: string, index: number) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = window.XLSX.utils.sheet_to_csv(sheet, { 
        FS: '\t',
        RS: '\n'
      });
      
      allText += `${'='.repeat(60)}\n`;
      allText += `Sheet ${index + 1}: ${sheetName}\n`;
      allText += `${'='.repeat(60)}\n\n`;
      allText += csv + '\n\n';
    });
    
    return allText.trim();
  }

  // ==================== DOCUMENT CONVERSION ====================
  
  async convertDocument(
    file: FileData,
    targetFormat: string,
    editedContent?: string
  ): Promise<Blob> {
    const content = editedContent || await this.extractEditableText(file);
    
    if (targetFormat === 'txt') {
      return new Blob([content], { type: 'text/plain' });
    } 
    
    if (targetFormat === 'html') {
      const html = this.textToHTML(content, file.filename);
      return new Blob([html], { type: 'text/html' });
    } 
    
    if (targetFormat === 'md') {
      const markdown = this.textToMarkdown(content);
      return new Blob([markdown], { type: 'text/markdown' });
    }
    
    if (targetFormat === 'csv') {
      return new Blob([content], { type: 'text/csv' });
    }
    
    if (targetFormat === 'json') {
      try {
        const parsed = JSON.parse(content);
        const formatted = JSON.stringify(parsed, null, 2);
        return new Blob([formatted], { type: 'application/json' });
      } catch {
        const jsonObj = { content: content };
        return new Blob([JSON.stringify(jsonObj, null, 2)], { type: 'application/json' });
      }
    }
    
    if (targetFormat === 'xml') {
      const xml = this.textToXML(content);
      return new Blob([xml], { type: 'application/xml' });
    }
    
    if (targetFormat === 'docx') {
      const docxHtml = this.textToWordCompatibleHTML(content, file.filename);
      return new Blob([docxHtml], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
    
    if (targetFormat === 'rtf') {
      const rtf = this.textToRTF(content);
      return new Blob([rtf], { type: 'application/rtf' });
    }
    
    if (targetFormat === 'odt') {
      const odt = this.textToODT(content, file.filename);
      return new Blob([odt], { type: 'application/vnd.oasis.opendocument.text' });
    }
    
    throw new Error(`Unsupported document conversion format: ${targetFormat}`);
  }

  private textToHTML(text: string, title: string): string {
    const lines = text.split('\n');
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
    }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    p { margin: 10px 0; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
`;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        const level = trimmed.match(/^#+/)?.[0].length || 1;
        const text = trimmed.replace(/^#+\s*/, '');
        html += `<h${level}>${this.escapeHtml(text)}</h${level}>\n`;
      } else if (trimmed) {
        html += `<p>${this.escapeHtml(line)}</p>\n`;
      } else {
        html += '<br>\n';
      }
    });
    
    html += '</body>\n</html>';
    return html;
  }

  private textToMarkdown(text: string): string {
    if (text.includes('#') || text.includes('**') || text.includes('*')) {
      return text;
    }
    
    const lines = text.split('\n');
    return lines.map(line => {
      if (line.trim()) {
        return line + '\n';
      }
      return '\n';
    }).join('');
  }

  private textToXML(text: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <content>${this.escapeXml(text)}</content>
</document>`;
  }

  private textToRTF(text: string): string {
    const rtfHeader = '{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0 Times New Roman;}}\n';
    const rtfBody = text
      .replace(/\\/g, '\\\\')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}')
      .replace(/\n/g, '\\par\n');
    const rtfFooter = '\n}';
    
    return rtfHeader + rtfBody + rtfFooter;
  }

  private textToODT(text: string, title: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0">
  <office:body>
    <office:text>
      <text:p>${this.escapeXml(text)}</text:p>
    </office:text>
  </office:body>
</office:document>`;
  }

  private textToWordCompatibleHTML(text: string, title: string): string {
    return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${this.escapeHtml(title)}</title>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
    p { margin: 0 0 10pt 0; }
  </style>
</head>
<body>
${text.split('\n').map(line => `<p>${this.escapeHtml(line) || '&nbsp;'}</p>`).join('\n')}
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  private getMimeType(format: string): string {
    const mimeTypes: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      svg: 'image/svg+xml',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      aac: 'audio/aac',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      flv: 'video/x-flv',
      txt: 'text/plain',
      html: 'text/html',
      md: 'text/markdown',
      csv: 'text/csv',
      json: 'application/json',
      xml: 'application/xml',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      rtf: 'application/rtf',
      odt: 'application/vnd.oasis.opendocument.text'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }

  downloadConvertedFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}