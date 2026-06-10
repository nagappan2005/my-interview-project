/**
 * Text chunking utility with token-aware splitting and overlap
 */

/**
 * Rough estimate: 1 token ≈ 4 characters for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks with specified token limit and overlap
 * @param text - The raw text to chunk
 * @param maxTokens - Maximum tokens per chunk (default: 512)
 * @param overlapPercent - Overlap percentage between chunks (default: 10)
 * @returns Array of text chunks with metadata
 */
export function chunkText(
  text: string,
  maxTokens: number = 512,
  overlapPercent: number = 10
): { content: string; tokens: number; chunkIndex: number }[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const maxChars = maxTokens * 4; // Convert tokens to approximate characters
  const overlapChars = Math.floor(maxChars * (overlapPercent / 100));
  const stepSize = maxChars - overlapChars;

  const chunks: { content: string; tokens: number; chunkIndex: number }[] = [];
  
  // Split by paragraphs first for better semantic boundaries
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    
    // If adding this paragraph would exceed the limit
    if (estimateTokens(currentChunk + '\n\n' + trimmedParagraph) > maxTokens && currentChunk.length > 0) {
      // Save current chunk
      const tokens = estimateTokens(currentChunk);
      chunks.push({ content: currentChunk.trim(), tokens, chunkIndex });
      chunkIndex++;
      
      // Start new chunk with overlap from the end of the previous chunk
      if (overlapChars > 0 && currentChunk.length > overlapChars) {
        const overlapText = currentChunk.slice(-overlapChars);
        currentChunk = overlapText + '\n\n' + trimmedParagraph;
      } else {
        currentChunk = trimmedParagraph;
      }
    } else {
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + trimmedParagraph;
      } else {
        currentChunk = trimmedParagraph;
      }
    }
    
    // If the current chunk itself exceeds maxTokens, force split it
    while (estimateTokens(currentChunk) > maxTokens) {
      let splitPoint = Math.min(maxChars, currentChunk.length);
      
      // Try to split at a sentence boundary
      const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
      let bestSplit = splitPoint;
      
      for (const ender of sentenceEnders) {
        const idx = currentChunk.lastIndexOf(ender, splitPoint);
        if (idx > splitPoint * 0.5) { // Don't split too early
          bestSplit = idx + ender.length;
          break;
        }
      }
      
      const chunkContent = currentChunk.slice(0, bestSplit).trim();
      if (chunkContent.length > 0) {
        const tokens = estimateTokens(chunkContent);
        chunks.push({ content: chunkContent, tokens, chunkIndex });
        chunkIndex++;
      }
      
      const remaining = currentChunk.slice(bestSplit).trim();
      if (overlapChars > 0 && chunkContent.length > overlapChars) {
        const overlapText = chunkContent.slice(-overlapChars);
        currentChunk = overlapText + ' ' + remaining;
      } else {
        currentChunk = remaining;
      }
    }
  }
  
  // Add the last chunk if there's remaining content
  if (currentChunk.trim().length > 0) {
    const tokens = estimateTokens(currentChunk.trim());
    chunks.push({ content: currentChunk.trim(), tokens, chunkIndex });
  }
  
  return chunks;
}
