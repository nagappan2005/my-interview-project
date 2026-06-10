/**
 * TF-IDF based text similarity search
 * Used for Retrieval-Augmented Generation (RAG) when no dedicated embedding API is available
 */

/**
 * Common English stop words to filter out during keyword extraction
 */
export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'about', 'above',
  'after', 'again', 'all', 'also', 'am', 'and', 'any', 'at', 'because',
  'before', 'between', 'both', 'but', 'by', 'each', 'for', 'from',
  'how', 'in', 'into', 'its', 'just', 'me', 'more', 'most', 'no',
  'nor', 'not', 'of', 'on', 'only', 'or', 'other', 'our', 'out',
  'over', 'own', 'same', 'so', 'some', 'still', 'such', 'than',
  'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'up', 'very', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with',
  'you', 'your',
]);

/**
 * Extract keywords from a query by removing stop words
 * Returns the important nouns/verbs that are more likely to match document content
 */
export function extractKeywords(query: string): string {
  const terms = tokenize(query);
  const keywords = terms.filter(term => !STOP_WORDS.has(term) && term.length > 2);
  return keywords.join(' ');
}

interface TFIDFVector {
  [term: string]: number;
}

/**
 * Tokenize text into terms
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 1); // Filter out single-character terms
}

/**
 * Compute term frequency for a document
 */
function computeTF(terms: string[]): TFIDFVector {
  const tf: TFIDFVector = {};
  const totalTerms = terms.length;
  
  for (const term of terms) {
    tf[term] = (tf[term] || 0) + 1;
  }
  
  // Normalize by total terms
  for (const term in tf) {
    tf[term] = tf[term] / totalTerms;
  }
  
  return tf;
}

/**
 * Compute IDF across all documents
 */
function computeIDF(documents: string[][]): TFIDFVector {
  const idf: TFIDFVector = {};
  const totalDocs = documents.length;
  
  // Count document frequency for each term
  for (const docTerms of documents) {
    const uniqueTerms = new Set(docTerms);
    for (const term of uniqueTerms) {
      idf[term] = (idf[term] || 0) + 1;
    }
  }
  
  // Compute IDF with smoothing
  for (const term in idf) {
    idf[term] = Math.log((totalDocs + 1) / (idf[term] + 1)) + 1;
  }
  
  return idf;
}

/**
 * Compute TF-IDF vector for a document
 */
export function computeTFIDF(text: string, idf: TFIDFVector): TFIDFVector {
  const terms = tokenize(text);
  const tf = computeTF(terms);
  const tfidf: TFIDFVector = {};
  
  for (const term in tf) {
    tfidf[term] = tf[term] * (idf[term] || Math.log(2)); // Use default IDF for unseen terms
  }
  
  return tfidf;
}

/**
 * Compute IDF from all existing chunks
 */
export function computeIDFFromChunks(chunkTexts: string[]): TFIDFVector {
  const documents = chunkTexts.map(text => tokenize(text));
  return computeIDF(documents);
}

/**
 * Compute cosine similarity between two TF-IDF vectors
 */
export function cosineSimilarity(vecA: TFIDFVector, vecB: TFIDFVector): number {
  const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (const term of allTerms) {
    const a = vecA[term] || 0;
    const b = vecB[term] || 0;
    
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search for the most similar chunks to a query
 * @param query - The user's query text
 * @param chunks - Array of document chunks with their TF-IDF vectors
 * @param topK - Number of results to return (default: 5)
 * @param threshold - Minimum similarity threshold (default: 0.05)
 * @returns Array of matched chunks sorted by similarity score
 */
export function searchSimilarChunks(
  query: string,
  chunks: { id: string; content: string; tfidf: string; documentId: string; chunkIndex: number }[],
  topK: number = 5,
  threshold: number = 0.05
): { id: string; content: string; documentId: string; chunkIndex: number; score: number }[] {
  if (chunks.length === 0) return [];
  
  // Compute IDF from all chunks + query
  const allTexts = chunks.map(c => c.content);
  allTexts.push(query);
  const idf = computeIDFFromChunks(allTexts);
  
  // Compute TF-IDF for query
  const queryTFIDF = computeTFIDF(query, idf);
  
  // Compute similarity for each chunk
  const results = chunks.map(chunk => {
    const chunkTFIDF = computeTFIDF(chunk.content, idf);
    const score = cosineSimilarity(queryTFIDF, chunkTFIDF);
    return {
      id: chunk.id,
      content: chunk.content,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      score,
    };
  });
  
  // Sort by similarity score (descending) and filter by threshold
  return results
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Search with keyword expansion fallback
 * First tries normal searchSimilarChunks, and if results are below threshold,
 * extracts keywords by removing stop words and re-runs the search.
 * Returns the best results found across both attempts.
 */
export function searchWithKeywordExpansion(
  query: string,
  chunks: { id: string; content: string; tfidf: string; documentId: string; chunkIndex: number }[],
  topK: number = 5,
  threshold: number = 0.05
): { id: string; content: string; documentId: string; chunkIndex: number; score: number }[] {
  if (chunks.length === 0) return [];

  // First try: normal search with full query
  const initialResults = searchSimilarChunks(query, chunks, topK, threshold);
  const maxScore = initialResults.length > 0 ? initialResults[0].score : 0;

  // If we have good results, return them
  if (initialResults.length > 0 && maxScore >= threshold) {
    return initialResults;
  }

  // Second try: extract keywords and search again
  const keywords = extractKeywords(query);
  if (keywords.trim().length === 0) {
    return initialResults; // No keywords to search with
  }

  const keywordResults = searchSimilarChunks(keywords, chunks, topK, threshold);

  // Merge and deduplicate results, keeping the best score for each chunk
  const resultMap = new Map<string, { id: string; content: string; documentId: string; chunkIndex: number; score: number }>();

  for (const result of [...initialResults, ...keywordResults]) {
    const existing = resultMap.get(result.id);
    if (!existing || result.score > existing.score) {
      resultMap.set(result.id, result);
    }
  }

  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
