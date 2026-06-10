import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { searchWithKeywordExpansion } from '@/lib/similarity';
import ZAI from 'z-ai-web-dev-sdk';

// Confidence threshold below which the AI should say it can't find the answer
const CONFIDENCE_THRESHOLD = 0.08;

function createSSEEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history, docIds } = await request.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(createSSEEvent('error', { error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      });
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
      const noDocAnswer = "I don't have any documents to search through yet. Please upload a PDF or TXT file first, and then I'll be able to answer your questions based on its content.";
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(createSSEEvent('token', { content: noDocAnswer })));
          controller.enqueue(encoder.encode(createSSEEvent('sources', { sources: [] })));
          controller.enqueue(encoder.encode(createSSEEvent('confidence', { confidence: 0 })));
          controller.enqueue(encoder.encode(createSSEEvent('done', {})));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
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

    // Perform similarity search with keyword expansion fallback
    const searchResults = searchWithKeywordExpansion(message, chunks, 5, 0.03);

    // Check confidence
    const maxScore = searchResults.length > 0 ? searchResults[0].score : 0;

    // If below threshold, try random chunk fallback
    let finalChunks = searchResults;
    let usedFallback = false;

    if (searchResults.length === 0 || maxScore < CONFIDENCE_THRESHOLD) {
      // Random chunk fallback — use up to 3 random chunks so the LLM can attempt an answer
      const shuffledChunks = [...chunks].sort(() => Math.random() - 0.5);
      const fallbackChunks = shuffledChunks.slice(0, 3);

      if (fallbackChunks.length > 0) {
        finalChunks = fallbackChunks.map(c => ({
          id: c.id,
          content: c.content,
          documentId: c.documentId,
          chunkIndex: c.chunkIndex,
          score: 0,
        }));
        usedFallback = true;
      }
    }

    // Format sources for the frontend
    const documentIds = [...new Set(finalChunks.map(r => r.documentId))];
    const documents = await db.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, filename: true },
    });
    const docMap = new Map(documents.map(d => [d.id, d.filename]));

    let sources = finalChunks.map(result => ({
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

    // Build context and prompt based on whether we have relevant results
    let systemPrompt: string;

    if (usedFallback) {
      const contextText = finalChunks
        .map((result, index) => `[Source ${index + 1}, Chunk ${result.chunkIndex}]:\n${result.content}`)
        .join('\n\n---\n\n');

      systemPrompt = `You are a precise document Q&A assistant. The search didn't find highly relevant passages for the user's question. Here are some excerpts from the documents. Provide the best answer you can based on these excerpts, and note that you're working with limited context.

RULES:
1. Only use information from the provided context below. Do not use any external knowledge.
2. Since the search didn't find directly relevant passages, provide the best answer you can from the available excerpts.
3. Clearly note to the user that you are working with limited context and that the answer may not be fully comprehensive.
4. Always cite which source(s) you used in your answer by referencing [Source X].
5. Be concise but helpful. Provide what information you can from the excerpts.
6. Suggest the user try a more specific question for better results.

CONTEXT FROM DOCUMENT EXCERPTS (limited relevance):
${contextText}`;
    } else if (finalChunks.length === 0) {
      systemPrompt = `You are a helpful document Q&A assistant. The user asked a question but no relevant information was found in the uploaded documents. Politely inform them that you cannot find the answer within the uploaded document. Be concise and suggest they try rephrasing their question or uploading more relevant documents.`;
    } else {
      const contextText = finalChunks
        .map((result, index) => `[Source ${index + 1}, Chunk ${result.chunkIndex}]:\n${result.content}`)
        .join('\n\n---\n\n');

      systemPrompt = `You are a precise document Q&A assistant. Your job is to answer questions STRICTLY based on the provided context from uploaded documents.

RULES:
1. Only use information from the provided context below. Do not use any external knowledge.
2. If the context doesn't contain enough information to fully answer the question, say so clearly.
3. Always cite which source(s) you used in your answer by referencing [Source X].
4. Be concise but thorough. Provide direct answers with supporting evidence from the context.
5. If multiple sources provide relevant information, synthesize them.
6. Do not make up or infer information that is not explicitly stated in the context.

CONTEXT FROM UPLOADED DOCUMENTS:
${contextText}`;
    }

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

    // Create the streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const zai = await ZAI.create();

          // Try streaming mode first
          const completion = await zai.chat.completions.create({
            messages,
            stream: true,
            thinking: { type: 'disabled' },
          });

          // Check if we got a ReadableStream (streaming mode worked)
          if (completion && typeof completion === 'object' && 'getReader' in completion) {
            const reader = (completion as ReadableStream<Uint8Array>).getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              // Parse SSE lines from the upstream
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;

                const jsonStr = trimmed.slice(5).trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(jsonStr);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(createSSEEvent('token', { content })));
                  }
                  // Check for finish
                  if (parsed.choices?.[0]?.finish_reason === 'stop') {
                    // Stream finished
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          } else {
            // Non-streaming response - send as single token
            const answer = (completion as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ||
              "I was unable to generate a response. Please try again.";

            // Split into word-sized chunks for a smoother appearance
            const words = answer.split(/(\s+)/);
            for (const word of words) {
              if (word) {
                controller.enqueue(encoder.encode(createSSEEvent('token', { content: word })));
              }
            }
          }

          // Send sources and confidence
          controller.enqueue(encoder.encode(createSSEEvent('sources', { sources })));
          controller.enqueue(encoder.encode(createSSEEvent('confidence', { confidence: maxScore })));
          controller.enqueue(encoder.encode(createSSEEvent('done', {})));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(createSSEEvent('error', {
            error: error instanceof Error ? error.message : 'Failed to generate response',
          })));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat stream error:', error);
    const errorStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(createSSEEvent('error', {
          error: 'Failed to process your question. Please try again.',
        })));
        controller.close();
      },
    });
    return new Response(errorStream, {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
}
