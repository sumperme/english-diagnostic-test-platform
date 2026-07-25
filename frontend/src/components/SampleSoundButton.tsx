import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useLocale } from '../i18n/LocaleContext';
import { fetchAudioBlob } from '../lib/api';

/** Client-provided volume-calibration track (not tied to any question). */
export const TESTING_AUDIO_URL = '/api/assets/audio/test-02/20260701_00_Testing_volume.mp3';

export type SampleSoundHandle = {
  /** Pause and reset playback (e.g. when starting a microphone test). */
  stop: () => void;
};

/**
 * Pre-test sound check: streams the official volume-testing track.
 * Click again while playing to stop. Blob is cached only for replays of this sample.
 */
export const SampleSoundButton = forwardRef<SampleSoundHandle, { sessionToken: string }>(
  function SampleSoundButton({ sessionToken }, ref) {
    const { t } = useLocale();
    const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    const stop = () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setState((prev) => (prev === 'error' ? 'error' : 'idle'));
    };

    useImperativeHandle(ref, () => ({ stop }), []);

    useEffect(() => {
      return () => {
        if (audioRef.current) {
          audioRef.current.onended = null;
          audioRef.current.pause();
          audioRef.current = null;
        }
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
      };
    }, []);

    const toggle = async () => {
      if (state === 'loading') return;
      if (state === 'playing') {
        stop();
        return;
      }
      try {
        if (!objectUrlRef.current) {
          setState('loading');
          objectUrlRef.current = await fetchAudioBlob(TESTING_AUDIO_URL, sessionToken);
        }
        const audio = audioRef.current ?? new Audio(objectUrlRef.current);
        audioRef.current = audio;
        audio.currentTime = 0;
        audio.onended = () => setState('idle');
        await audio.play();
        setState('playing');
      } catch {
        setState('error');
      }
    };

    const label =
      state === 'loading'
        ? t.test2.audioLoading
        : state === 'playing'
          ? t.test2.audioCheckStop
          : state === 'error'
            ? t.test2.audioError
            : t.test2.audioCheckPlay;

    return (
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={state === 'loading'}
        className={`inline-flex items-center gap-3 rounded-xl px-8 py-4 text-sm font-bold uppercase tracking-[0.08em] transition-all ${
          state === 'playing'
            ? 'bg-edt-forest text-edt-neon hover:bg-[#243b37]'
            : state === 'loading'
              ? 'cursor-wait bg-edt-forest/80 text-edt-neon'
              : state === 'error'
                ? 'border-2 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'bg-edt-forest text-edt-neon hover:bg-[#243b37] hover:shadow-neon'
        }`}
      >
        {state === 'playing' ? (
          <span className="flex items-end gap-0.5" aria-hidden="true">
            <span className="h-3 w-1 animate-pulse rounded-full bg-edt-neon" />
            <span className="h-4 w-1 animate-pulse rounded-full bg-edt-neon [animation-delay:150ms]" />
            <span className="h-2 w-1 animate-pulse rounded-full bg-edt-neon [animation-delay:300ms]" />
          </span>
        ) : (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {label}
      </button>
    );
  },
);
