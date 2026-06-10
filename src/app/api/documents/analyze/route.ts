import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { STOP_WORDS } from '@/lib/similarity';

/**
 * Tokenize text into terms — same logic as similarity.ts
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 1);
}

export async function GET() {
  try {
    // Fetch all document chunks with their parent document info
    const chunks = await db.documentChunk.findMany({
      include: {
        document: {
          select: {
            id: true,
            filename: true,
          },
        },
      },
    });

    if (chunks.length === 0) {
      return NextResponse.json({
        terms: [],
        totalTerms: 0,
        uniqueTerms: 0,
      });
    }

    // Aggregate word counts per document
    const docTermCounts: Record<string, Record<string, number>> = {};
    const globalTermCounts: Record<string, number> = {};
    let totalTerms = 0;

    for (const chunk of chunks) {
      const docId = chunk.documentId;
      const filename = chunk.document.filename;
      const key = `${docId}::${filename}`;

      if (!docTermCounts[key]) {
        docTermCounts[key] = {};
      }

      const tokens = tokenize(chunk.content);

      for (const token of tokens) {
        // Skip stop words and very short words
        if (STOP_WORDS.has(token) || token.length <= 2) continue;

        totalTerms++;
        globalTermCounts[token] = (globalTermCounts[token] || 0) + 1;
        docTermCounts[key][token] = (docTermCounts[key][token] || 0) + 1;
      }
    }

    // Sort by frequency and take top 30
    const sortedTerms = Object.entries(globalTermCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30);

    // Build response with per-document breakdown
    const terms = sortedTerms.map(([term, count]) => {
      const documents: { filename: string; count: number }[] = [];

      for (const [docKey, termCounts] of Object.entries(docTermCounts)) {
        const docCount = termCounts[term];
        if (docCount && docCount > 0) {
          const filename = docKey.split('::')[1];
          documents.push({ filename, count: docCount });
        }
      }

      // Sort documents by count descending
      documents.sort((a, b) => b.count - a.count);

      return {
        term,
        count,
        documents,
      };
    });

    return NextResponse.json({
      terms,
      totalTerms,
      uniqueTerms: Object.keys(globalTermCounts).length,
    });
  } catch (error) {
    console.error('Failed to analyze documents:', error);
    return NextResponse.json(
      { error: 'Failed to analyze documents' },
      { status: 500 }
    );
  }
}
