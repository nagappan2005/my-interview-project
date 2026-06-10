import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { searchSimilarChunks, searchWithKeywordExpansion } from '@/lib/similarity';
import ZAI from 'z-ai-web-dev-sdk';

// Confidence threshold below which we consider the search results low-confidence
const CONFIDENCE_THRESHOLD = 0.08;

export async function POST(request: NextRequest) {
  try {
    const { message, history, docIds } = await request.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build the where clause for document filtering
    const docWhere: { status: string; id?: { in: string[] } } = { status: 'ready' };
    if (docIds && Array.isArray(docIds) && docIds.length > 0) {
      docWhere.id = { in: docIds };
    }

    // Check if any documents are ready
    const readyDocs = await db.document.count({
      where: docWhere,
    });

    if (readyDocs === 0) {
      return NextResponse.json({
        answer: "I don't have any documents to search through yet. Please upload a PDF or TXT file first, and then I'll be able to answer your questions based on its content.",
        sources: [],
        confidence: 0,
      });
    }

    // Get all chunks from selected/ready documents
    const chunks = await db.documentChunk.findMany({
      where: {
        document: docWhere,
      },
      select: {
        id: true,
        content: true,
        tfidf: true,
        documentId: true,
        chunkIndex: true,
      },
    });

    // Step 1: Perform similarity search with keyword expansion fallback
    const searchResults = searchWithKeywordExpansion(message, chunks, 5, 0.03);

    // Step 2: Check confidence of results
    const maxScore = searchResults.length > 0 ? searchResults[0].score : 0;

    if (searchResults.length === 0 || maxScore < CONFIDENCE_THRESHOLD) {
      // Step 3: Try random chunk fallback — use up to 3 random chunks as context
      // so the LLM can at least attempt a summary-based answer
      const shuffledChunks = [...chunks].sort(() => Math.random() - 0.5);
      const fallbackChunks = shuffledChunks.slice(0, 3);

      if (fallbackChunks.length === 0) {
        // Truly no chunks at all
        const zai = await ZAI.create();
        const systemPrompt = `You are a helpful document Q&A assistant. The user asked a question but no relevant information was found in the uploaded documents. Politely inform them that you cannot find the answer within the uploaded document. Be concise and suggest they try rephrasing their question or uploading more relevant documents.`;

        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'assistant', content: systemPrompt },
            { role: 'user', content: message },
          ],
          thinking: { type: 'disabled' },
        });

        const answer = completion.choices?.[0]?.message?.content ||
          "I cannot find the answer within the uploaded document. Please try rephrasing your question or upload additional documents that might contain the relevant information.";

        return NextResponse.json({
          answer,
          sources: [],
          confidence: maxScore,
        });
      }

      // Build context from random fallback chunks
      const fallbackContextText = fallbackChunks
        .map((chunk, index) => `[Source ${index + 1}, Chunk ${chunk.chunkIndex}]:\n${chunk.content}`)
        .join('\n\n---\n\n');

      // Get document names for fallback sources
      const fallbackDocIds = [...new Set(fallbackChunks.map(c => c.documentId))];
      const fallbackDocuments = await db.document.findMany({
        where: { id: { in: fallbackDocIds } },
        select: { id: true, filename: true },
      });
      const fallbackDocMap = new Map(fallbackDocuments.map(d => [d.id, d.filename]));

      // Use a special system prompt for the fallback case
      const fallbackSystemPrompt = `You are a precise document Q&A assistant. The search didn't find highly relevant passages for the user's question. Here are some excerpts from the documents. Provide the best answer you can based on these excerpts, and note that you're working with limited context.

RULES:
1. Only use information from the provided context below. Do not use any external knowledge.
2. Since the search didn't find directly relevant passages, provide the best answer you can from the available excerpts.
3. Clearly note to the user that you are working with limited context and that the answer may not be fully comprehensive.
4. Always cite which source(s) you used in your answer by referencing [Source X].
5. Be concise but helpful. Provide what information you can from the excerpts.
6. Suggest the user try a more specific question for better results.

CONTEXT FROM DOCUMENT EXCERPTS (limited relevance):
${fallbackContextText}`;

      const zai = await ZAI.create();

      // Build conversation with history
      const messages: { role: 'assistant' | 'user'; content: string }[] = [
        { role: 'assistant', content: fallbackSystemPrompt },
      ];

      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-6)) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      }

      messages.push({ role: 'user', content: message });

      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });

      const answer = completion.choices?.[0]?.message?.content ||
        "I wasn't able to find highly relevant passages in the documents. Please try a more specific question for better results.";

      // Format fallback sources for the frontend
      let sources = fallbackChunks.map(chunk => ({
        id: chunk.id,
        filename: fallbackDocMap.get(chunk.documentId) || 'Unknown',
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score: 0,
      }));

      // Normalize source scores for better display
      const maxFallbackScore = Math.max(...sources.map(s => s.score), 0);
      if (maxFallbackScore > 0) {
        sources = sources.map(s => ({
          ...s,
          score: Math.round(Math.min((s.score / maxFallbackScore) * 0.85, 1.0) * 100) / 100,
        }));
      } else {
        // Fallback chunks - show minimal relevance
        sources = sources.map(s => ({
          ...s,
          score: 0.05,
        }));
      }

      return NextResponse.json({
        answer,
        sources,
        confidence: maxScore,
      });
    }

    // Build context from search results
    const contextText = searchResults
      .map((result, index) => `[Source ${index + 1}, Chunk ${result.chunkIndex}]:\n${result.content}`)
      .join('\n\n---\n\n');

    // Get document names for sources
    const documentIds = [...new Set(searchResults.map(r => r.documentId))];
    const documents = await db.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, filename: true },
    });
    const docMap = new Map(documents.map(d => [d.id, d.filename]));

    // Build the RAG prompt
    const systemPrompt = `You are a precise document Q&A assistant. Your job is to answer questions STRICTLY based on the provided context from uploaded documents.

RULES:
1. Only use information from the provided context below. Do not use any external knowledge.
2. If the context doesn't contain enough information to fully answer the question, say so clearly.
3. Always cite which source(s) you used in your answer by referencing [Source X].
4. Be concise but thorough. Provide direct answers with supporting evidence from the context.
5. If multiple sources provide relevant information, synthesize them.
6. Do not make up or infer information that is not explicitly stated in the context.

CONTEXT FROM UPLOADED DOCUMENTS:
${contextText}`;

    // Initialize ZAI and generate response
    const zai = await ZAI.create();

    // Build conversation with history
    const messages: { role: 'assistant' | 'user'; content: string }[] = [
      { role: 'assistant', content: systemPrompt },
    ];

    // Add conversation history if provided
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });

    const answer = completion.choices?.[0]?.message?.content || 
      "I was unable to generate a response. Please try again.";

    // Format sources for the frontend
    let sources = searchResults.map(result => ({
      id: result.id,
      filename: docMap.get(result.documentId) || 'Unknown',
      chunkIndex: result.chunkIndex,
      content: result.content,
      score: Math.round(result.score * 100) / 100,
    }));

    // Normalize source scores for better display
    const maxSourceScore = Math.max(...sources.map(s => s.score), 0);
    if (maxSourceScore > 0) {
      sources = sources.map(s => ({
        ...s,
        score: Math.round(Math.min((s.score / maxSourceScore) * 0.85, 1.0) * 100) / 100,
      }));
    } else {
      // Fallback chunks - show minimal relevance
      sources = sources.map(s => ({
        ...s,
        score: 0.05,
      }));
    }

    return NextResponse.json({
      answer,
      sources,
      confidence: maxScore,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process your question. Please try again.' },
      { status: 500 }
    );
  }
}
