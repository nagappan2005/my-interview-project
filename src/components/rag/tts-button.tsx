'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, Loader2, VolumeX } from 'lucide-react';

type TtsState = 'idle' | 'loading' | 'playing' | 'error';

interface TtsButtonProps {
  text: string;
  disabled?: boolean;
}

export function TtsButton({ text, disabled }: TtsButtonProps) {
  const [state, setState] = useState<TtsState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    // If currently playing, stop
    if (state === 'playing' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setState('idle');
      return;
    }

    if (!text.trim() || disabled) return;

    setState('loading');

    try {
      // Split text into chunks of max 1024 chars
      const chunks = splitTextIntoChunks(text, 1024);
      const audioBuffers: ArrayBuffer[] = [];

      for (const chunk of chunks) {
        const response = await fetch('/api/chat/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk }),
        });

        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        audioBuffers.push(buffer);
      }

      // Concatenate audio buffers
      const totalLength = audioBuffers.reduce(
        (sum, buf) => sum + buf.byteLength,
        0
      );
      const combinedBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of audioBuffers) {
        combinedBuffer.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
      }

      // Clean up previous audio
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      // Create blob URL and play
      const blob = new Blob([combinedBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setState('idle');
      };

      audio.onerror = () => {
        setState('error');
        setTimeout(() => setState('idle'), 2000);
      };

      await audio.play();
      setState('playing');
    } catch (err) {
      console.error('TTS playback error:', err);
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [text, disabled, state]);

  // Determine icon and styling based on state
  const getIcon = () => {
    switch (state) {
      case 'loading':
        return <Loader2 size={11} className="animate-spin" />;
      case 'playing':
        return <Volume2 size={11} className="animate-pulse" />;
      case 'error':
        return <VolumeX size={11} />;
      default:
        return <Volume2 size={11} />;
    }
  };

  const getClassName = () => {
    const base = 'p-1 rounded-md transition-all';

    switch (state) {
      case 'loading':
        return `${base} text-white/60 cursor-wait`;
      case 'playing':
        return `${base} text-purple-400/80 bg-purple-500/10`;
      case 'error':
        return `${base} text-red-400/80 bg-red-500/10`;
      default:
        return `${base} text-white/40 hover:text-purple-400/80 hover:bg-white/[0.06]`;
    }
  };

  const getTitle = () => {
    switch (state) {
      case 'loading':
        return 'Generating speech...';
      case 'playing':
        return 'Stop speech';
      case 'error':
        return 'Speech failed';
      default:
        return 'Read aloud';
    }
  };

  return (
    <button
      onClick={handleClick}
      className={getClassName()}
      title={getTitle()}
      aria-label={getTitle()}
      disabled={disabled && state === 'idle'}
    >
      {getIcon()}
    </button>
  );
}

/**
 * Split text into chunks of maxCharLength, trying to break at sentence boundaries.
 */
function splitTextIntoChunks(text: string, maxCharLength: number): string[] {
  if (text.length <= maxCharLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxCharLength) {
      chunks.push(remaining);
      break;
    }

    // Try to find a sentence boundary within the limit
    let splitIndex = -1;
    const searchLimit = Math.min(remaining.length, maxCharLength);

    // Look for sentence-ending punctuation
    for (let i = searchLimit - 1; i >= Math.max(0, searchLimit - 100); i--) {
      if ('.!?。！？'.includes(remaining[i])) {
        splitIndex = i + 1;
        break;
      }
    }

    // If no sentence boundary, try space/newline
    if (splitIndex === -1) {
      for (let i = searchLimit - 1; i >= Math.max(0, searchLimit - 50); i--) {
        if (' \n\t'.includes(remaining[i])) {
          splitIndex = i + 1;
          break;
        }
      }
    }

    // If still no good split point, just cut at maxCharLength
    if (splitIndex === -1 || splitIndex === 0) {
      splitIndex = maxCharLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks.filter((chunk) => chunk.length > 0);
}
