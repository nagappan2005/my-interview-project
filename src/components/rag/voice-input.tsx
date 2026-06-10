'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

const MAX_RECORDING_DURATION = 60_000; // 60 seconds

export function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore errors on cleanup
      }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setAudioLevel(0);
  }, []);

  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        // Normalize to 0–1 range (typical average is 0–128)
        setAudioLevel(Math.min(avg / 100, 1));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch {
      // Audio analysis not supported — waveform won't animate but recording still works
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          transcribeAudio(blob);
        } else {
          setIsRecording(false);
          toast.error('No audio recorded. Please try again.');
        }
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);

      // Start audio analysis for waveform
      startAudioAnalysis(stream);

      // Auto-stop after max duration
      timerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_DURATION);
    } catch (err) {
      console.error('Microphone access error:', err);
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          toast.error('Microphone access denied. Please allow microphone permissions in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          toast.error('No microphone found. Please connect a microphone and try again.');
        } else {
          toast.error('Could not access microphone. Please check your browser settings.');
        }
      } else {
        toast.error('An unexpected error occurred while accessing the microphone.');
      }
    }
  }, [startAudioAnalysis]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  const transcribeAudio = useCallback(async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch('/api/chat/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Transcription failed' }));
        throw new Error(data.error || `Transcription failed with status ${response.status}`);
      }

      const data = await response.json();
      const transcript = data.text?.trim();

      if (transcript) {
        onTranscript(transcript);
        toast.success('Voice input transcribed successfully');
      } else {
        toast.error('No speech detected. Please try again and speak clearly.');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscript]);

  const handleClick = useCallback(() => {
    if (isTranscribing || disabled) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, isTranscribing, disabled, stopRecording, startRecording]);

  // Waveform bars data
  const barCount = 5;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const baseHeight = 4;
    const levelBoost = audioLevel * 16;
    const staggerFactor = 1 - Math.abs(i - (barCount - 1) / 2) / ((barCount - 1) / 2);
    const height = baseHeight + levelBoost * staggerFactor;
    return height;
  });

  return (
    <div className="relative flex items-center">
      <motion.button
        whileHover={!disabled && !isTranscribing ? { scale: 1.08 } : undefined}
        whileTap={!disabled && !isTranscribing ? { scale: 0.92 } : undefined}
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        aria-label={isRecording ? 'Stop voice recording' : 'Start voice input'}
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 border ${
          isRecording
            ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30 hover:border-red-500/40 shadow-md shadow-red-500/10'
            : isTranscribing
              ? 'bg-purple-500/15 border-purple-500/10 text-purple-400/60 cursor-wait'
              : 'bg-white/[0.05] border-white/[0.08] text-white/50 hover:text-white/65 hover:bg-white/[0.08] hover:border-white/[0.1]'
        } disabled:opacity-20 disabled:cursor-not-allowed`}
      >
        {isTranscribing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isRecording ? (
          <MicOff size={16} />
        ) : (
          <Mic size={16} />
        )}

        {/* Recording pulse ring */}
        {isRecording && (
          <span className="absolute inset-0 rounded-xl animate-ring-pulse pointer-events-none border border-red-500/30" />
        )}
      </motion.button>

      {/* Waveform & Listening indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
            animate={{ opacity: 1, width: 'auto', marginLeft: 8 }}
            exit={{ opacity: 0, width: 0, marginLeft: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2 overflow-hidden"
          >
            {/* Waveform bars */}
            <div className="flex items-center gap-[2px] h-6">
              {bars.map((height, i) => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full bg-red-400/70"
                  animate={{
                    height: `${height}px`,
                    opacity: audioLevel > 0.05 ? 0.7 + audioLevel * 0.3 : 0.3,
                  }}
                  transition={{
                    duration: 0.08,
                    ease: 'easeOut',
                  }}
                  style={{ minHeight: '3px' }}
                />
              ))}
            </div>
            <span className="text-[10px] text-red-400/60 whitespace-nowrap font-medium tracking-wide">
              Listening...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcribing indicator */}
      <AnimatePresence>
        {isTranscribing && !isRecording && (
          <motion.div
            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
            animate={{ opacity: 1, width: 'auto', marginLeft: 8 }}
            exit={{ opacity: 0, width: 0, marginLeft: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 overflow-hidden"
          >
            <span className="text-[10px] text-purple-400/50 whitespace-nowrap">
              Transcribing...
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
