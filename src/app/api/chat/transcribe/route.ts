import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'No audio file provided. Please include an "audio" field in the form data.' },
        { status: 400 }
      );
    }

    // Check file size (limit to 25MB)
    const maxFileSize = 25 * 1024 * 1024;
    if (audioFile.size > maxFileSize) {
      return NextResponse.json(
        { error: `Audio file too large (${(audioFile.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 25MB.` },
        { status: 400 }
      );
    }

    // Check minimum file size (avoid empty recordings)
    if (audioFile.size < 100) {
      return NextResponse.json(
        { error: 'Audio file is too small or empty. Please record for a longer duration.' },
        { status: 400 }
      );
    }

    // Convert audio blob to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');

    // Use z-ai-web-dev-sdk for ASR (backend only)
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const response = await zai.audio.asr.create({
      file_base64: base64Audio,
    });

    const transcript = response.text?.trim();

    if (!transcript) {
      return NextResponse.json(
        { error: 'No speech detected in the audio. Please try again and speak clearly.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: transcript,
    });
  } catch (err) {
    console.error('Transcription error:', err);
    const message = err instanceof Error ? err.message : 'An unexpected error occurred during transcription';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
