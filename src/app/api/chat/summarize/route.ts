import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body as { content: string };

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Dynamic import for z-ai-web-dev-sdk (backend only)
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const zai = new ZAI();

    const response = await zai.chat.completions.create({
      model: 'default',
      messages: [
        {
          role: 'system',
          content: 'Summarize the following text in 1-2 concise sentences. Preserve key facts and conclusions.',
        },
        {
          role: 'user',
          content: content.trim(),
        },
      ],
    });

    const summary = response.choices?.[0]?.message?.content?.trim() || '';

    if (!summary) {
      return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json({ error: 'Summarization failed' }, { status: 500 });
  }
}
