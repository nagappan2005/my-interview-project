/**
 * PDF and text file extraction utilities
 */

import { PDFParse } from 'pdf-parse';

/**
 * Extract text from a PDF buffer
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer as any });
    const result = await parser.getText();
    await parser.destroy();
    
    // Combine text from all pages
    const fullText = result.pages
      .map((page: { text: string; num: number }) => page.text)
      .join('\n\n');
    
    return fullText;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a TXT buffer
 */
export function extractTextFromTXT(buffer: Buffer): string {
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    throw new Error(`Failed to extract text from TXT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate file type - only PDF and TXT are supported
 */
export function validateFileType(mimetype: string, filename: string): 'pdf' | 'txt' | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (mimetype === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mimetype === 'text/plain' || ext === 'txt') return 'txt';
  return null;
}
