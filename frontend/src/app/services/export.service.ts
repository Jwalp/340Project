// frontend/src/app/services/export.service.ts
import { Injectable } from '@angular/core';
import { FileService, FileData } from './file.service';
import { ToastService } from './toast.service';

// Global declarations for external libraries
declare global {
  interface Window {
    FFmpeg: any;
    FFmpegUtil: any;
    pdfjsLib: any;
    mammoth: any;
    XLSX: any;
    marked: any;
    odf: any;
  }
}

export interface ConversionOptions {
  format: string;
  quality?: number;
  width?: number;
  height?: number;
  bitrate?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private ffmpeg: any = null;
  private ffmpegLoaded = false;

  // Supported conversions
  readonly imageFormats = ['jpg', 'png', 'webp', 'gif', 'bmp', 'ico'];
  readonly audioFormats = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
  readonly videoFormats = ['mp4', 'webm', 'avi', 'mov'];
  readonly documentFormats = ['pdf', 'txt', 'html', 'md', 'docx', 'csv'];

  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {
    this.initFFmpeg();
  }

  private async initFFmpeg() {
    // Check if FFmpeg script is loaded, if not wait for it
    const waitForFFmpeg = () => {
      return new Promise<void>((resolve) => {
        if (window.FFmpeg) {
          resolve();
        } else {
          const checkInterval = setInterval(() => {
            if (window.FFmpeg) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          
          // Timeout after 30 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            console.error('FFmpeg script failed to load');
            resolve();
          }, 30000);
        }
      });
    };

    try {
      await waitForFFmpeg();
      
      if (!window.FFmpeg) {
        console.error('FFmpeg not available');
        return;
      }

      const { FFmpeg } = window.FFmpeg;
      this.ffmpeg = new FFmpeg();
      
      this.ffmpeg.on('log', ({ message }: any) => {
        console.log('FFmpeg:', message);
      });

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      if (!window.FFmpegUtil) {
        console.error('FFmpegUtil not available');
        return;
      }
      
      const { toBlobURL } = window.FFmpegUtil;
      
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.ffmpegLoaded = true;
      console.log('✅ FFmpeg loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load FFmpeg:', error);
      this.ffmpegLoaded = false;
    }
  }

  isFFmpegReady(): boolean {
    return this.ffmpegLoaded;
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
    
    // Markdown extraction
    if (mimeType === 'text/markdown') {
      return await blob!.text();
    }
    
    // Plain text and other text formats
    if (mimeType.startsWith('text/')) {
      return await blob!.text();
    }
    
    // ODT extraction (OpenDocument Text)
    if (mimeType === 'application/vnd.oasis.opendocument.text') {
      return await this.extractTextFromODT(blob!);
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
      
      // Preserve line breaks and spacing
      let lastY = -1;
      let pageText = '';
      
      textContent.items.forEach((item: any) => {
        // Add line break if Y position changed significantly
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        }
        pageText += item.str;
        
        // Add space if the next item doesn't immediately follow
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
    
    // Clean up excessive whitespace while preserving paragraph breaks
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
        FS: '\t', // Use tab separator for better formatting
        RS: '\n'
      });
      
      allText += `${'='.repeat(60)}\n`;
      allText += `Sheet ${index + 1}: ${sheetName}\n`;
      allText += `${'='.repeat(60)}\n\n`;
      allText += csv + '\n\n';
    });
    
    return allText.trim();
  }

  private async extractTextFromODT(blob: Blob): Promise<string> {
    // ODT is a ZIP containing XML - basic extraction
    try {
      const text = await blob.text();
      // Remove XML tags for basic text extraction
      return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch {
      throw new Error('Unable to extract text from ODT');
    }
  }

  // ==================== IMAGE CONVERSION ====================
  
  async convertImage(
    file: FileData,
    targetFormat: string,
    quality: number = 90
  ): Promise<Blob> {
    if (!this.ffmpegLoaded) {
      throw new Error('FFmpeg not loaded');
    }

    const { fetchFile } = window.FFmpegUtil;
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    const inputName = `input.${this.getFileExtension(file.filename)}`;
    const outputName = `output.${targetFormat}`;

    await this.ffmpeg.writeFile(inputName, await fetchFile(blob!));

    const args = ['-i', inputName];
    
    if (targetFormat === 'jpg' || targetFormat === 'jpeg') {
      args.push('-quality', quality.toString());
    } else if (targetFormat === 'png') {
      args.push('-compression_level', '9');
    } else if (targetFormat === 'webp') {
      args.push('-quality', quality.toString());
    }
    
    args.push(outputName);
    await this.ffmpeg.exec(args);

    const data = await this.ffmpeg.readFile(outputName);
    const mimeType = this.getMimeType(targetFormat);
    
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return new Blob([data], { type: mimeType });
  }

  // ==================== AUDIO CONVERSION ====================
  
  async convertAudio(
    file: FileData,
    targetFormat: string,
    bitrate: string = '192k'
  ): Promise<Blob> {
    if (!this.ffmpegLoaded) {
      throw new Error('FFmpeg not loaded');
    }

    const { fetchFile } = window.FFmpegUtil;
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    const inputName = `input.${this.getFileExtension(file.filename)}`;
    const outputName = `output.${targetFormat}`;

    await this.ffmpeg.writeFile(inputName, await fetchFile(blob!));

    const args = ['-i', inputName, '-b:a', bitrate];
    
    if (targetFormat === 'mp3') {
      args.push('-codec:a', 'libmp3lame');
    } else if (targetFormat === 'aac') {
      args.push('-codec:a', 'aac');
    }
    
    args.push(outputName);
    await this.ffmpeg.exec(args);

    const data = await this.ffmpeg.readFile(outputName);
    const mimeType = this.getMimeType(targetFormat);
    
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return new Blob([data], { type: mimeType });
  }

  // ==================== VIDEO CONVERSION ====================
  
  async convertVideo(
    file: FileData,
    targetFormat: string,
    options?: { width?: number; height?: number; bitrate?: string }
  ): Promise<Blob> {
    if (!this.ffmpegLoaded) {
      throw new Error('FFmpeg not loaded');
    }

    const { fetchFile } = window.FFmpegUtil;
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    const inputName = `input.${this.getFileExtension(file.filename)}`;
    const outputName = `output.${targetFormat}`;

    await this.ffmpeg.writeFile(inputName, await fetchFile(blob!));

    const args = ['-i', inputName];
    
    if (options?.width && options?.height) {
      args.push('-vf', `scale=${options.width}:${options.height}`);
    }
    
    if (options?.bitrate) {
      args.push('-b:v', options.bitrate);
    }
    
    args.push(outputName);
    await this.ffmpeg.exec(args);

    const data = await this.ffmpeg.readFile(outputName);
    const mimeType = this.getMimeType(targetFormat);
    
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return new Blob([data], { type: mimeType });
  }

  async extractAudio(file: FileData, targetFormat: string = 'mp3'): Promise<Blob> {
    if (!this.ffmpegLoaded) {
      throw new Error('FFmpeg not loaded');
    }

    const { fetchFile } = window.FFmpegUtil;
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    const inputName = `input.${this.getFileExtension(file.filename)}`;
    const outputName = `output.${targetFormat}`;

    await this.ffmpeg.writeFile(inputName, await fetchFile(blob!));

    await this.ffmpeg.exec([
      '-i', inputName,
      '-vn',
      '-acodec', targetFormat === 'mp3' ? 'libmp3lame' : 'copy',
      '-b:a', '192k',
      outputName
    ]);

    const data = await this.ffmpeg.readFile(outputName);
    const mimeType = this.getMimeType(targetFormat);
    
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return new Blob([data], { type: mimeType });
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
      // If content looks like CSV, keep it; otherwise format it
      return new Blob([content], { type: 'text/csv' });
    }
    
    if (targetFormat === 'docx') {
      // For DOCX, we'll create an HTML that Word can open
      const docxHtml = this.textToWordCompatibleHTML(content, file.filename);
      return new Blob([docxHtml], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
    
    throw new Error('Unsupported document conversion');
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
    // Already markdown if it has markdown syntax
    if (text.includes('#') || text.includes('**') || text.includes('*')) {
      return text;
    }
    
    // Convert plain text to markdown with proper formatting
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
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
      ico: 'image/x-icon', mp3: 'audio/mpeg', wav: 'audio/wav',
      ogg: 'audio/ogg', aac: 'audio/aac', m4a: 'audio/m4a',
      mp4: 'video/mp4', webm: 'video/webm', avi: 'video/x-msvideo',
      mov: 'video/quicktime', txt: 'text/plain', html: 'text/html',
      md: 'text/markdown', pdf: 'application/pdf', csv: 'text/csv',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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