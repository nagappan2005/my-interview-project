import { NextRequest, NextResponse } from 'next/server';

const MAX_TTS_CHARS = 1024;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice, speed } = body as {
      text: string;
      voice?: string;
      speed?: number;
    };

    // Validate text
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Truncate if longer than 1024 chars
    let processedText = text.trim();
    if (processedText.length > MAX_TTS_CHARS) {
      processedText = processedText.slice(0, MAX_TTS_CHARS - 3) + '...';
    }

    // Validate voice
    const validVoices = [
      'tongtong',
      'chuichui',
      'xiaochen',
      'jam',
      'kazi',
      'douji',
      'luodo',
    ];
    const selectedVoice =
      voice && validVoices.includes(voice) ? voice : 'tongtong';

    // Validate speed
    const clampedSpeed =
      speed !== undefined
        ? Math.min(Math.max(Number(speed), 0.5), 2.0)
        : 1.0;

    // Dynamic import for z-ai-web-dev-sdk (backend only)
    const { default: zai } = await import('z-ai-web-dev-sdk');

    // Generate TTS audio
    const response = await zai.audio.tts.create({
      input: processedText,
      voice: selectedVoice,
      speed: clampedSpeed,
      response_format: 'wav',
      stream: false,
    });

    // Get audio buffer from response
    const audioBuffer = await response.arrayBuffer();

    // Return WAV audio with proper headers
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
