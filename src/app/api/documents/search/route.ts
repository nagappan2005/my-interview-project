import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { searchWithKeywordExpansion } from '@/lib/similarity';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q');
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Get all enabled, ready documents' chunks
    const documents = await db.document.findMany({
      where: { status: 'ready' },
      select: { id: true },
    });

    if (documents.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const docIds = documents.map(d => d.id);

    const chunks = await db.documentChunk.findMany({
      where: {
        documentId: { in: docIds },
      },
      select: {
        id: true,
        content: true,
        documentId: true,
        chunkIndex: true,
        tfidf: true,
      },
    });

    if (chunks.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Use TF-IDF similarity search
    const searchResults = searchWithKeywordExpansion(query.trim(), chunks, 5, 0.02);

    // Enrich results with filename
    const resultDocIds = [...new Set(searchResults.map(r => r.documentId))];
    const docMap = new Map<string, string>();
    if (resultDocIds.length > 0) {
      const docs = await db.document.findMany({
        where: { id: { in: resultDocIds } },
        select: { id: true, filename: true },
      });
      for (const doc of docs) {
        docMap.set(doc.id, doc.filename);
      }
    }

    const results = searchResults.map(r => {
      // Create a snippet with keyword highlighting context
      const content = r.content;
      const snippetLength = 150;
      const queryLower = query.toLowerCase();
      const contentLower = content.toLowerCase();
      const matchIdx = contentLower.indexOf(queryLower.split(/\s+/)[0] || queryLower);
      const start = Math.max(0, matchIdx > 0 ? matchIdx - 30 : 0);
      const snippet = content.slice(start, start + snippetLength) + (content.length > start + snippetLength ? '...' : '');

      return {
        id: r.id,
        filename: docMap.get(r.documentId) || 'Unknown',
        chunkIndex: r.chunkIndex,
        snippet: start > 0 ? '...' + snippet : snippet,
        score: Math.round(r.score * 100) / 100,
        content: r.content,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Document search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
