import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../i18n/LocaleContext';
import { fetchAudioBlob } from '../lib/api';

type PlayerState = 'idle' | 'loading' | 'playing' | 'done' | 'error';

const playedStorageKey = (attemptId: string) => `edt.audioPlayed.${attemptId}`;

function loadPlayedSet(attemptId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(playedStorageKey(attemptId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markPlayed(attemptId: string, questionCode: string) {
  const played = loadPlayedSet(attemptId);
  played.add(questionCode);
  sessionStorage.setItem(playedStorageKey(attemptId), JSON.stringify([...played]));
}

/**
 * Once-only listening clip player. The play button permanently disables the
 * moment playback starts; the played flag persists per attempt+question in
 * sessionStorage so re-renders or question navigation cannot re-enable it.
 * A retry is only offered when the fetch fails BEFORE any playback happened.
 */
export function AudioOncePlayer({
  attemptId,
  questionCode,
  url,
  sessionToken,
  onPlaybackChange,
}: {
  attemptId: string;
  questionCode: string;
  url: string;
  sessionToken: string;
  onPlaybackChange?: (playing: boolean) => void;
}) {
  const { t } = useLocale();
  const [state, setState] = useState<PlayerState>(() =>
    loadPlayedSet(attemptId).has(questionCode) ? 'done' : 'idle',
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Playback continues while the candidate navigates between questions; only
  // clean up the object URL when the whole player unmounts after finishing.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      onPlaybackChange?.(false);
    };
  }, [onPlaybackChange]);

  useEffect(() => {
    onPlaybackChange?.(state === 'playing');
  }, [state, onPlaybackChange]);

  const play = async () => {
    if (state !== 'idle' && state !== 'error') return;
    setState('loading');
    try {
      const objectUrl = await fetchAudioBlob(url, sessionToken);
      objectUrlRef.current = objectUrl;
      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setState('done');
        onPlaybackChange?.(false);
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
      };
      // The single allowed play is consumed as soon as playback begins.
      markPlayed(attemptId, questionCode);
      await audio.play();
      setState('playing');
      onPlaybackChange?.(true);
    } catch {
      // Fetch/decode failed before playback — allow a retry.
      if (!loadPlayedSet(attemptId).has(questionCode)) {
        setState('error');
      } else {
        setState('done');
      }
    }
  };

  const disabled = state === 'loading' || state === 'playing' || state === 'done';
  const label =
    state === 'loading'
      ? t.test2.audioLoading
      : state === 'playing'
        ? t.test2.audioPlaying
        : state === 'done'
          ? t.test2.audioPlayed
          : state === 'error'
            ? t.test2.audioError
            : t.test2.playAudio;

  return (
    <div className="rounded-2xl border-2 border-slate-100 bg-white p-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void play()}
          disabled={disabled}
          aria-label={t.test2.playAudio}
          className={`inline-flex items-center gap-3 rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] transition-all ${
            state === 'done'
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : state === 'playing'
                ? 'cursor-default bg-edt-forest text-edt-neon'
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
              {state === 'done' ? (
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              ) : (
                <path d="M6.3 4.06a1 1 0 011.03.06l7 5a1 1 0 010 1.76l-7 5A1 1 0 016 15V5a1 1 0 01.3-.94z" />
              )}
            </svg>
          )}
          {label}
        </button>
        <p className="text-xs font-medium leading-relaxed text-edt-olive sm:text-sm">{t.test2.playOnceNote}</p>
      </div>
    </div>
  );
}
