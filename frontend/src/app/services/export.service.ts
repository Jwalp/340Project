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
  // Supported conversions (browser-native)
  readonly imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'svg'];
  readonly audioFormats = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'webm'];
  readonly videoFormats = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'flv'];
  readonly documentFormats = ['txt', 'html', 'md', 'csv', 'docx', 'pdf', 'rtf', 'odt', 'ods', 'xml', 'json'];

  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {
    console.log('✅ Export service ready');
  }

  isFFmpegReady(): boolean {
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
    
    // Special handling for SVG - can't convert via canvas easily
    if (targetFormat === 'svg') {
      const ext = this.getFileExtension(file.filename);
      if (ext === 'svg') {
        // SVG to SVG - just return original
        return blob!;
      }
      // Can't convert raster to SVG
      throw new Error('Cannot convert raster images to SVG format');
    }
    
    // If source is SVG, handle differently
    const sourceExt = this.getFileExtension(file.filename);
    if (sourceExt === 'svg') {
      return await this.convertSVGToRaster(blob!, targetFormat, quality);
    }
    
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
          
          // Use SVG dimensions or default to reasonable size
          canvas.width = img.width || 800;
          canvas.height = img.height || 600;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // White background for non-transparent formats
          if (targetFormat === 'jpg' || targetFormat === 'jpeg' || targetFormat === 'bmp') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob(
            (resultBlob) => {
              if (resultBlob) {
                resolve(resultBlob);
              } else {
                reject(new Error('Failed to convert SVG'));
              }
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
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    // Check if source and target are the same
    const sourceExt = this.getFileExtension(file.filename);
    if (sourceExt === targetFormat) {
      return blob!;
    }
    
    // Use Web Audio API for basic conversions
    try {
      const arrayBuffer = await blob!.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // For WAV conversion, we can create it directly
      if (targetFormat === 'wav') {
        return this.audioBufferToWav(audioBuffer);
      }
      
      // For other formats, we need to re-encode
      // This is a simplified approach - real conversion would need more complex encoding
      this.toastService.info(`Converting ${sourceExt.toUpperCase()} to ${targetFormat.toUpperCase()}...`);
      
      // Create a new blob with the audio data
      // Note: This is a basic conversion, quality may vary
      return await this.encodeAudioBuffer(audioBuffer, targetFormat);
      
    } catch (error) {
      console.error('Audio conversion error:', error);
      throw new Error(`Failed to convert audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private audioBufferToWav(audioBuffer: AudioBuffer): Blob {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    
    const data = new Float32Array(audioBuffer.length * numberOfChannels);
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < audioBuffer.length; i++) {
        data[i * numberOfChannels + channel] = channelData[i];
      }
    }
    
    const dataLength = data.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    
    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    const volume = 0.8;
    let index = 44;
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i] * volume));
      view.setInt16(index, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      index += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  private async encodeAudioBuffer(audioBuffer: AudioBuffer, targetFormat: string): Promise<Blob> {
    // First convert to WAV as intermediate format
    const wavBlob = this.audioBufferToWav(audioBuffer);
    
    // If target is WAV, we're done
    if (targetFormat === 'wav') {
      return wavBlob;
    }
    
    // For other formats, we'll use MediaRecorder if available
    if (typeof MediaRecorder !== 'undefined') {
      try {
        return await this.recordAudioBuffer(audioBuffer, targetFormat);
      } catch (error) {
        console.warn('MediaRecorder failed, returning WAV:', error);
        this.toastService.warning(`Direct conversion to ${targetFormat.toUpperCase()} not available, converted to WAV`);
        return wavBlob;
      }
    }
    
    // Fallback to WAV
    this.toastService.warning(`Direct conversion to ${targetFormat.toUpperCase()} not available, converted to WAV`);
    return wavBlob;
  }

  private async recordAudioBuffer(audioBuffer: AudioBuffer, targetFormat: string): Promise<Blob> {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    
    const dest = offlineContext.destination;
    source.connect(dest);
    source.start();
    
    const renderedBuffer = await offlineContext.startRendering();
    
    // Create MediaStream from buffer
    const mediaStreamDest = new AudioContext().createMediaStreamDestination();
    const newSource = new AudioContext().createBufferSource();
    newSource.buffer = renderedBuffer;
    newSource.connect(mediaStreamDest);
    
    // Determine MIME type
    let mimeType = 'audio/webm';
    if (targetFormat === 'ogg') mimeType = 'audio/ogg';
    else if (targetFormat === 'mp3') mimeType = 'audio/mpeg';
    
    // Record the stream
    const recorder = new MediaRecorder(mediaStreamDest.stream, { mimeType });
    const chunks: Blob[] = [];
    
    return new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = reject;
      
      recorder.start();
      newSource.start();
      
      setTimeout(() => {
        recorder.stop();
        newSource.stop();
      }, (renderedBuffer.duration * 1000) + 100);
    });
  }

  // ==================== VIDEO CONVERSION ====================
  
  async convertVideo(
    file: FileData,
    targetFormat: string,
    options?: { width?: number; height?: number; bitrate?: string }
  ): Promise<Blob> {
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    // Check if source and target are the same
    const sourceExt = this.getFileExtension(file.filename);
    if (sourceExt === targetFormat) {
      return blob!;
    }
    
    // Use MediaRecorder API for format conversion
    try {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(blob!);
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });
      
      // Create canvas for video capture
      const canvas = document.createElement('canvas');
      canvas.width = options?.width || video.videoWidth;
      canvas.height = options?.height || video.videoHeight;
      
      const stream = canvas.captureStream(30); // 30 FPS
      
      // Add audio if present
      const audioContext = new AudioContext();
      const mediaStream = new MediaStream();
      
      // Try to get audio from video
      try {
        const audioSource = audioContext.createMediaElementSource(video);
        const dest = audioContext.createMediaStreamDestination();
        audioSource.connect(dest);
        dest.stream.getAudioTracks().forEach(track => mediaStream.addTrack(track));
      } catch (e) {
        console.warn('No audio track or audio access failed');
      }
      
      stream.getVideoTracks().forEach(track => mediaStream.addTrack(track));
      
      // Determine MIME type
      let mimeType = `video/${targetFormat}`;
      if (targetFormat === 'webm') mimeType = 'video/webm;codecs=vp8';
      else if (targetFormat === 'mp4') mimeType = 'video/mp4';
      
      const recorder = new MediaRecorder(mediaStream, { 
        mimeType,
        videoBitsPerSecond: options?.bitrate ? parseInt(options.bitrate) * 1000 : 2500000
      });
      
      const chunks: Blob[] = [];
      
      return new Promise((resolve, reject) => {
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          URL.revokeObjectURL(video.src);
          resolve(new Blob(chunks, { type: mimeType }));
        };
        recorder.onerror = reject;
        
        // Draw video frames to canvas
        const ctx = canvas.getContext('2d')!;
        const drawFrame = () => {
          if (video.ended || video.paused) {
            recorder.stop();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        };
        
        recorder.start();
        video.play();
        drawFrame();
      });
      
    } catch (error) {
      console.error('Video conversion error:', error);
      throw new Error(`Failed to convert video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractAudio(file: FileData, targetFormat: string = 'mp3'): Promise<Blob> {
    const blob = await this.fileService.downloadFile(file.id).toPromise();
    
    try {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(blob!);
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(video);
      const dest = audioContext.createMediaStreamDestination();
      source.connect(dest);
      
      let mimeType = 'audio/webm';
      if (targetFormat === 'mp3') mimeType = 'audio/mpeg';
      else if (targetFormat === 'ogg') mimeType = 'audio/ogg';
      else if (targetFormat === 'wav') mimeType = 'audio/wav';
      
      const recorder = new MediaRecorder(dest.stream, { mimeType });
      const chunks: Blob[] = [];
      
      return new Promise((resolve, reject) => {
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          URL.revokeObjectURL(video.src);
          resolve(new Blob(chunks, { type: mimeType }));
        };
        recorder.onerror = reject;
        
        recorder.start();
        video.play();
        
        video.onended = () => {
          recorder.stop();
        };
      });
      
    } catch (error) {
      console.error('Audio extraction error:', error);
      throw new Error(`Failed to extract audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    
    if (targetFormat === 'json') {
      try {
        // Try to format as JSON if it's valid JSON
        const parsed = JSON.parse(content);
        const formatted = JSON.stringify(parsed, null, 2);
        return new Blob([formatted], { type: 'application/json' });
      } catch {
        // If not valid JSON, wrap it
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
    
    if (targetFormat === 'pdf') {
      // PDF generation would require a library like jsPDF
      throw new Error('PDF generation requires additional library. Please use HTML or DOCX format instead.');
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
    // Basic ODT structure (simplified)
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
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
      svg: 'image/svg+xml',
      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      aac: 'audio/aac',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      webm: 'audio/webm',
      // Video
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      mpeg: 'video/mpeg',
      flv: 'video/x-flv',
      // Documents
      txt: 'text/plain',
      html: 'text/html',
      md: 'text/markdown',
      csv: 'text/csv',
      json: 'application/json',
      xml: 'application/xml',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
      rtf: 'application/rtf',
      odt: 'application/vnd.oasis.opendocument.text',
      ods: 'application/vnd.oasis.opendocument.spreadsheet'
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