// frontend/src/app/services/export.service.ts
import { Injectable } from '@angular/core';
import { FileService, FileData } from './file.service';
import { ToastService } from './toast.service';

declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
    XLSX: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  // Supported conversions (browser-native only)
  readonly imageFormats = ['png', 'jpg', 'webp', 'bmp', 'ico'];
  readonly audioFormats = ['mp3', 'wav', 'ogg'];
  readonly videoFormats = ['mp4', 'webm'];
  readonly documentFormats = ['txt', 'html', 'md', 'csv', 'docx'];

  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {
    console.log('✅ Export service ready (using browser-native conversions)');
  }

  isFFmpegReady(): boolean {
    // Always return true since we're using browser-native methods
    return true;
  }

  // ==================== DOCUMENT EDITING ====================
  
  async extractEditableText(file: FileData): Promise<string> {
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    const mimeType = file.mimeType;
    
    // PDF extraction
    if (mimeType === 'application/pdf') {
      return await this.extractTextFromPDF(blob!);
    }
    
    // DOCX extraction
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await this.extractTextFromDOCX(blob!);
    }
    
    // Excel extraction
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel') {
      return await this.extractTextFromExcel(blob!);
    }
    
    // HTML extraction
    if (mimeType === 'text/html') {
      const html = await blob!.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body.textContent || doc.body.innerText || '';
    }
    
    // Plain text and other text formats
    if (mimeType.startsWith('text/')) {
      return await blob!.text();
    }
    
    // CSV
    if (mimeType === 'text/csv') {
      return await blob!.text();
    }
    
    // JSON
    if (mimeType === 'application/json') {
      const json = await blob!.text();
      return JSON.stringify(JSON.parse(json), null, 2);
    }
    
    // XML
    if (mimeType === 'application/xml' || mimeType === 'text/xml') {
      return await blob!.text();
    }
    
    // Default: try to read as text
    try {
      return await blob!.text();
    } catch {
      throw new Error('Unable to extract text from this document type');
    }
  }

  private async extractTextFromPDF(blob: Blob): Promise<string> {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js not loaded');
    }

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
    if (!window.mammoth) {
      throw new Error('Mammoth.js not loaded');
    }

    const arrayBuffer = await blob.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    
    return result.value
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async extractTextFromExcel(blob: Blob): Promise<string> {
    if (!window.XLSX) {
      throw new Error('SheetJS not loaded');
    }

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

  // ==================== IMAGE CONVERSION (Canvas API) ====================
  
  async convertImage(
    file: FileData,
    targetFormat: string,
    quality: number = 0.9
  ): Promise<Blob> {
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob!);
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          
          // Draw image on white background for formats that don't support transparency
          if (targetFormat === 'jpg' || targetFormat === 'jpeg' || targetFormat === 'bmp') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          ctx.drawImage(img, 0, 0);
          
          // Convert to target format
          const mimeType = this.getMimeType(targetFormat);
          
          // Special handling for GIF - canvas doesn't directly export to GIF
          // So we'll export as PNG which browsers handle well
          if (targetFormat === 'gif') {
            canvas.toBlob(
              (resultBlob) => {
                URL.revokeObjectURL(url);
                if (resultBlob) {
                  // Return as PNG but warn user
                  this.toastService.info('GIF export limited - converting to PNG instead');
                  resolve(resultBlob);
                } else {
                  reject(new Error('Failed to convert image'));
                }
              },
              'image/png',
              1.0
            );
          } else {
            canvas.toBlob(
              (resultBlob) => {
                URL.revokeObjectURL(url);
                if (resultBlob) {
                  resolve(resultBlob);
                } else {
                  reject(new Error('Failed to convert image'));
                }
              },
              mimeType,
              quality
            );
          }
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

  // ==================== AUDIO CONVERSION (Limited) ====================
  
  async convertAudio(
    file: FileData,
    targetFormat: string,
    bitrate: string = '192k'
  ): Promise<Blob> {
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    // Browser can't convert audio formats without server-side processing
    this.toastService.warning(`Audio conversion requires server processing. Downloading original ${file.filename}`);
    return blob!;
  }

  // ==================== VIDEO CONVERSION (Limited) ====================
  
  async convertVideo(
    file: FileData,
    targetFormat: string,
    options?: { width?: number; height?: number; bitrate?: string }
  ): Promise<Blob> {
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    // Browser can't convert video formats without server-side processing
    this.toastService.warning(`Video conversion requires server processing. Downloading original ${file.filename}`);
    return blob!;
  }

  async extractAudio(file: FileData, targetFormat: string = 'mp3'): Promise<Blob> {
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    this.toastService.warning(`Audio extraction requires server processing. Downloading original ${file.filename}`);
    return blob!;
  }

  // ==================== DOCUMENT CONVERSION ====================
  
  async convertDocument(
    file: FileData,
    targetFormat: string,
    editedContent?: string
  ): Promise<Blob> {
    console.log('Converting document to:', targetFormat);
    console.log('Has edited content:', !!editedContent);
    
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
    
    if (targetFormat === 'docx') {
      const docxHtml = this.textToWordCompatibleHTML(content, file.filename);
      return new Blob([docxHtml], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
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

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  private getMimeType(format: string): string {
    const mimeTypes: { [key: string]: string } = {
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
      // Video
      mp4: 'video/mp4',
      webm: 'video/webm',
      // Documents
      txt: 'text/plain',
      html: 'text/html',
      md: 'text/markdown',
      csv: 'text/csv',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf'
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