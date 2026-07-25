import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type MouseEvent,
} from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { LeavePageModal } from '../components/LeavePageModal';
import { PassageViewer } from '../components/PassageViewer';
import { SampleSoundButton, type SampleSoundHandle } from '../components/SampleSoundButton';
import { useLocale } from '../i18n/LocaleContext';
import {
  ApiError,
  fetchAttemptReport,
  fetchAudioBlob,
  saveAttemptTextAnswer,
  startAttempt,
  submitAttempt,
  uploadAttemptAudio,
} from '../lib/api';
import { formatTime } from '../lib/format';
import type { AttemptInstance, AttemptItem, CandidateInfo, Session, Test2Result } from '../types';

const MIC_TEST_MAX_SECONDS = 5;
/** On-screen 3-2-1 arming window; matches Recording_Start_Sound_3Sec duration. */
const ARMING_SECONDS = 3;
const RECORDING_START_BEEP = '/api/assets/audio/test-03/Recording_Start_Sound_3Sec.mp3';
const RECORDING_STOP_BEEP = '/api/assets/audio/test-03/Recording_Stop_Sound.mp3';
const BEEP_FETCH_TIMEOUT_MS = 2000;
const BEEP_PLAY_TIMEOUT_MS = 4500;

type BeepCache = { start?: string; stop?: string };

function wordCount(text: string): number {
  const t = text.trim();
  return t.length === 0 ? 0 : t.split(/\s+/).length;
}

async function resolveBeepUrl(
  kind: 'start' | 'stop',
  sessionToken: string,
  cache: BeepCache,
): Promise<string | null> {
  const cached = cache[kind];
  if (cached) return cached;
  try {
    const path = kind === 'start' ? RECORDING_START_BEEP : RECORDING_STOP_BEEP;
    const url = await Promise.race([
      fetchAudioBlob(path, sessionToken),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('BEEP_FETCH_TIMEOUT')), BEEP_FETCH_TIMEOUT_MS);
      }),
    ]);
    cache[kind] = url;
    return url;
  } catch {
    return null;
  }
}

/** Play start/stop cue; always resolves (skips on fetch/play failure) so recording can proceed. */
async function playRecordingBeep(
  kind: 'start' | 'stop',
  sessionToken: string,
  cache: BeepCache,
): Promise<void> {
  const url = await resolveBeepUrl(kind, sessionToken, cache);
  if (!url) return;
  await new Promise<void>((resolve) => {
    const audio = new Audio(url);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().catch(finish);
    window.setTimeout(finish, BEEP_PLAY_TIMEOUT_MS);
  });
}

/**
 * Ask for mic permission then immediately release tracks.
 * Keeps the click-gesture permission grant without leaving the mic open
 * (open mic triggers browser/OS ducking of speaker audio during the start cue).
 */
async function warmMicPermission(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((tr) => tr.stop());
}

function revokeBeepCache(cache: BeepCache) {
  if (cache.start) URL.revokeObjectURL(cache.start);
  if (cache.stop) URL.revokeObjectURL(cache.stop);
  cache.start = undefined;
  cache.stop = undefined;
}

/** Large green 3-2-1 display shared by mic check and speaking tasks. */
function ArmingCountdown({ seconds }: { seconds: number }) {
  const { t } = useLocale();
  if (seconds <= 0) return null;
  return (
    <div className="mb-4 text-center">
      <p className="font-display text-6xl font-bold tabular-nums leading-none text-emerald-600 sm:text-7xl">
        {seconds}
      </p>
      <p className="mt-3 text-base font-semibold text-emerald-700 sm:text-lg">
        {t.test2.speakingStartsIn.replace('{n}', String(seconds))}
      </p>
    </div>
  );
}

function padQuestionNumber(n: number): string {
  return String(n).padStart(2, '0');
}

/** Display a duration as `MM min SS sec` (locale template via caller when needed). */
function formatMinSec(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
  const ss = String(clamped % 60).padStart(2, '0');
  return `${mm} min ${ss} sec`;
}

function formatSpeakingDuration(totalSeconds: number, template: string): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
  const ss = String(clamped % 60).padStart(2, '0');
  return template.replace('{mm}', mm).replace('{ss}', ss);
}

function blockCopyInteraction(event: ClipboardEvent | MouseEvent) {
  event.preventDefault();
}

function paintScrollingWave(
  g: CanvasRenderingContext2D,
  width: number,
  height: number,
  history: number[],
) {
  const midY = height / 2;
  g.fillStyle = '#1B2D2A';
  g.fillRect(0, 0, width, height);
  g.strokeStyle = 'rgba(244,244,244,0.2)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, midY);
  g.lineTo(width, midY);
  g.stroke();
  g.strokeStyle = '#CEFF1A';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < history.length; i++) {
    const x = width - (history.length - 1 - i);
    const amp = history[i];
    const y = midY - amp * (midY - 4);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  for (let i = history.length - 1; i >= 0; i--) {
    const x = width - (history.length - 1 - i);
    const amp = history[i];
    const y = midY + amp * (midY - 4);
    g.lineTo(x, y);
  }
  if (history.length > 0) {
    g.closePath();
    g.fillStyle = 'rgba(206,255,26,0.2)';
    g.fill();
    g.stroke();
  }
}

/**
 * Mic check: record ≤5s with a scrolling time–amplitude graph (current level at
 * the right edge), then auto-play the clip once while replaying the waveform.
 * Does not persist the test recording.
 */
function MicCheckPanel({
  sessionToken,
  onOk,
  onStartRecording,
}: {
  sessionToken: string;
  onOk: (ok: boolean) => void;
  /** Called when mic capture starts — parent should stop the sample sound. */
  onStartRecording: () => void;
}) {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<'idle' | 'arming' | 'recording' | 'playing' | 'done' | 'error'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(MIC_TEST_MAX_SECONDS);
  const [armLeft, setArmLeft] = useState(ARMING_SECONDS);
  const [starting, setStarting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const historyRef = useRef<number[]>([]);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const beepCacheRef = useRef<BeepCache>({});
  /** Invalidates in-flight start/finish when the panel unmounts (or Strict Mode remounts). */
  const runIdRef = useRef(0);
  const startingRef = useRef(false);
  const finishingRef = useRef(false);

  const stopDrawLoop = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const cleanupCapture = () => {
    stopDrawLoop();
    window.clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* already stopped */
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  };

  const cleanupPlayback = () => {
    stopDrawLoop();
    if (playbackRef.current) {
      playbackRef.current.onended = null;
      playbackRef.current.pause();
      playbackRef.current = null;
    }
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  };

  useEffect(() => {
    const runId = ++runIdRef.current;
    void resolveBeepUrl('start', sessionToken, beepCacheRef.current);
    void resolveBeepUrl('stop', sessionToken, beepCacheRef.current);
    return () => {
      // Bump run id so any in-flight start() from a Strict Mode double-mount aborts cleanly.
      if (runIdRef.current === runId) runIdRef.current += 1;
      finishingRef.current = false;
      startingRef.current = false;
      cleanupCapture();
      cleanupPlayback();
      revokeBeepCache(beepCacheRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawScrollingAmplitude = (analyser: AnalyserNode) => {
    const timeData = new Uint8Array(analyser.fftSize);
    historyRef.current = [];

    const tick = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const g = canvas.getContext('2d');
      if (!g) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      analyser.getByteTimeDomainData(timeData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const centered = (timeData[i] - 128) / 128;
        sumSq += centered * centered;
      }
      const rms = Math.min(1, Math.sqrt(sumSq / timeData.length) * 2.2);
      const history = historyRef.current;
      history.push(rms);
      if (history.length > canvas.width) history.shift();

      paintScrollingWave(g, canvas.width, canvas.height, history);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const playRecordingWithWaveform = async (blob: Blob, runId: number) => {
    const url = URL.createObjectURL(blob);
    playbackUrlRef.current = url;
    const audio = new Audio(url);
    playbackRef.current = audio;
    setPhase('playing');

    const finishOk = () => {
      if (runIdRef.current !== runId) return;
      cleanupPlayback();
      finishingRef.current = false;
      setPhase('done');
      onOk(true);
    };

    try {
      const ctx = new AudioContext();
      if (runIdRef.current !== runId) {
        void ctx.close().catch(() => undefined);
        return;
      }
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      drawScrollingAmplitude(analyser);
      audio.onended = finishOk;
      await audio.play();
    } catch {
      audio.onended = finishOk;
      void audio.play().catch(finishOk);
    }
  };

  const finishRecording = (runId: number) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    stopDrawLoop();
    window.clearInterval(timerRef.current);

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      finishingRef.current = false;
      if (runIdRef.current === runId) {
        setPhase('error');
        onOk(false);
      }
      return;
    }

    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      void audioCtxRef.current?.close().catch(() => undefined);
      audioCtxRef.current = null;
      recorderRef.current = null;

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      chunksRef.current = [];
      if (runIdRef.current !== runId) return;
      if (blob.size === 0) {
        finishingRef.current = false;
        setPhase('error');
        onOk(false);
        return;
      }
      // Stop cue after mic is released (avoids ducking). Replay is the user clip only —
      // never re-play the start cue, which would sound like the clip "contains" it.
      void (async () => {
        await playRecordingBeep('stop', sessionToken, beepCacheRef.current);
        if (runIdRef.current !== runId) return;
        await playRecordingWithWaveform(blob, runId);
      })();
    };
    try {
      recorder.stop();
    } catch {
      finishingRef.current = false;
      if (runIdRef.current === runId) {
        setPhase('error');
        onOk(false);
      }
    }
  };

  const beginMicRecording = async (runId: number) => {
    if (runIdRef.current !== runId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (runIdRef.current !== runId) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.start(100);

      setPhase('recording');
      setSecondsLeft(MIC_TEST_MAX_SECONDS);
      drawScrollingAmplitude(analyser);

      timerRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            window.clearInterval(timerRef.current);
            finishRecording(runId);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      if (runIdRef.current === runId) {
        cleanupCapture();
        setPhase('error');
        onOk(false);
      }
    }
  };

  const start = async () => {
    // Guard with a ref so Strict Mode / rapid clicks cannot stack starts.
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    cleanupPlayback();
    finishingRef.current = false;
    onStartRecording();
    onOk(false);

    const runId = ++runIdRef.current;

    try {
      // Permission warm-up on the click gesture, then RELEASE the mic so the
      // browser/OS does not duck the 3-second start cue on the speakers.
      await warmMicPermission();
      if (runIdRef.current !== runId) return;

      setArmLeft(ARMING_SECONDS);
      setPhase('arming');

      const countdownDone = new Promise<void>((resolve) => {
        let left = ARMING_SECONDS;
        timerRef.current = window.setInterval(() => {
          left -= 1;
          setArmLeft(Math.max(0, left));
          if (left <= 0) {
            window.clearInterval(timerRef.current);
            resolve();
          }
        }, 1000);
      });

      // Play start cue with mic closed; wait until both UI countdown and audio finish.
      await Promise.all([playRecordingBeep('start', sessionToken, beepCacheRef.current), countdownDone]);
      if (runIdRef.current !== runId) return;

      setArmLeft(0);
      // Open mic only after the cue has fully ended — prevents cue bleed into the clip.
      await beginMicRecording(runId);
    } catch {
      if (runIdRef.current === runId) {
        cleanupCapture();
        setPhase('error');
        onOk(false);
      }
    } finally {
      if (runIdRef.current === runId) {
        startingRef.current = false;
        setStarting(false);
      }
    }
  };

  const stop = () => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') return;
    finishRecording(runIdRef.current);
  };

  const showGraph = phase === 'recording' || phase === 'playing';

  return (
    <div className="text-center">
      <h2 className="mb-4 text-xl font-extrabold uppercase tracking-[0.12em] text-edt-forest">
        {t.test2.micCheckTitle}
      </h2>
      <p className="mx-auto mb-8 max-w-lg text-sm leading-relaxed text-slate-600">{t.test2.micCheckBody}</p>
      {phase === 'arming' ? <ArmingCountdown seconds={armLeft} /> : null}
      {showGraph ? (
        <canvas ref={canvasRef} width={480} height={96} className="mx-auto mb-6 w-full max-w-lg rounded-lg bg-edt-forest" />
      ) : null}
      <div className="flex flex-col items-center gap-3">
        {phase === 'idle' || phase === 'done' || phase === 'error' ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => void start()}
            className="inline-flex items-center justify-center rounded-xl bg-edt-forest px-8 py-4 text-sm font-bold uppercase tracking-[0.08em] text-edt-neon hover:bg-[#243b37] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? t.test2.startingRecording : t.test2.micCheckStart}
          </button>
        ) : null}
        {phase === 'recording' ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center justify-center rounded-xl border border-edt-gold px-8 py-4 text-sm font-bold uppercase tracking-[0.08em] text-edt-forest"
          >
            {t.test2.micCheckStop} ({secondsLeft}s)
          </button>
        ) : null}
        {phase === 'playing' ? (
          <span className="text-sm font-semibold text-edt-olive">{t.test2.micCheckPlaying}</span>
        ) : null}
        {phase === 'error' ? <span className="text-sm text-rose-600">{t.test2.micCheckError}</span> : null}
        {phase === 'done' ? (
          <span className="max-w-lg text-sm font-semibold leading-relaxed text-emerald-700">{t.test2.micCheckOk}</span>
        ) : null}
      </div>
    </div>
  );
}

type SpeakingPhase = 'ready' | 'prompt' | 'prep' | 'arming' | 'recording' | 'saving' | 'done';

export type SpeakingRecorderHandle = {
  /** Auto-stop / commit when leaving via Next or Previous. */
  commit: () => Promise<void>;
};

const SpeakingRecorder = forwardRef<
  SpeakingRecorderHandle,
  {
    item: AttemptItem;
    audioUrl: string | null;
    sessionToken: string;
    attemptId: string;
    alreadySaved: boolean;
    /** Seconds of audio captured when already saved in this session (0 if unknown / no audio). */
    savedDurationSec?: number;
    onBusyChange: (busy: boolean) => void;
    onSaved: (durationSec: number) => void;
  }
>(function SpeakingRecorder(
  { item, audioUrl, sessionToken, attemptId, alreadySaved, savedDurationSec = 0, onBusyChange, onSaved },
  ref,
) {
  const { t } = useLocale();
  const meta = item.meta ?? {};
  const maxSeconds = meta.maxSeconds ?? 60;
  const prepSeconds = meta.prepSeconds ?? 0;
  const [phase, setPhase] = useState<SpeakingPhase>(alreadySaved ? 'done' : 'ready');
  const [prepLeft, setPrepLeft] = useState(prepSeconds);
  const [armLeft, setArmLeft] = useState(ARMING_SECONDS);
  const [recLeft, setRecLeft] = useState(maxSeconds);
  const [recordedSeconds, setRecordedSeconds] = useState(alreadySaved ? savedDurationSec : 0);
  const [error, setError] = useState<string | null>(null);
  const [showWave, setShowWave] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const historyRef = useRef<number[]>([]);
  const promptAudioRef = useRef<HTMLAudioElement | null>(null);
  const promptUrlRef = useRef<string | null>(null);
  const beepCacheRef = useRef<BeepCache>({});
  const phaseRef = useRef(phase);
  const finishingRef = useRef(false);
  const uploadStartedRef = useRef(false);
  const recordingStartedRef = useRef(false);
  const recordingKickoffRef = useRef(false);
  const recordStartedAtRef = useRef<number | null>(null);
  const recordedSecondsRef = useRef(alreadySaved ? savedDurationSec : 0);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  phaseRef.current = phase;

  // Only lock nav while uploading — prompt/recording/arming allow Next/Prev commit.
  const busy = phase === 'saving';
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  const speakTimeLabel = useMemo(() => {
    const time =
      maxSeconds >= 120 ? t.test2.speakingTimeTwoMin : t.test2.speakingTimeOneMin;
    return t.test2.speakingTimeLabel.replace('{time}', time);
  }, [maxSeconds, t.test2.speakingTimeLabel, t.test2.speakingTimeOneMin, t.test2.speakingTimeTwoMin]);

  const stopDrawLoop = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const paintIdleWave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    historyRef.current = [];
    paintScrollingWave(g, canvas.width, canvas.height, []);
  };

  const freezeWave = () => {
    stopDrawLoop();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    paintScrollingWave(g, canvas.width, canvas.height, historyRef.current);
  };

  const stopPromptAudio = () => {
    if (promptAudioRef.current) {
      promptAudioRef.current.onended = null;
      promptAudioRef.current.pause();
      promptAudioRef.current = null;
    }
    if (promptUrlRef.current) {
      URL.revokeObjectURL(promptUrlRef.current);
      promptUrlRef.current = null;
    }
  };

  const cleanupCapture = () => {
    stopDrawLoop();
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  };

  const playBeep = (kind: 'start' | 'stop') =>
    playRecordingBeep(kind, sessionToken, beepCacheRef.current);

  useEffect(() => {
    // Reset abort flags on every mount (React Strict Mode remounts once in dev).
    finishingRef.current = false;
    recordingKickoffRef.current = false;
    uploadStartedRef.current = false;
    recordingStartedRef.current = false;
    // Prefetch beeps so arming → record is not delayed by network.
    void resolveBeepUrl('start', sessionToken, beepCacheRef.current);
    void resolveBeepUrl('stop', sessionToken, beepCacheRef.current);
    return () => {
      finishingRef.current = true;
      stopPromptAudio();
      if (mediaRef.current && mediaRef.current.state !== 'inactive') {
        try {
          mediaRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      cleanupCapture();
      revokeBeepCache(beepCacheRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wave: hidden while prompt plays; visible from 3-2-1 countdown through recording.
  useEffect(() => {
    if (phase === 'recording' || phase === 'saving' || phase === 'done') return;
    if (phase === 'arming') {
      setShowWave(true);
      requestAnimationFrame(() => paintIdleWave());
    } else {
      setShowWave(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const drawScrollingAmplitude = (analyser: AnalyserNode) => {
    const timeData = new Uint8Array(analyser.fftSize);
    historyRef.current = [];

    const tick = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const g = canvas.getContext('2d');
      if (!g) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      analyser.getByteTimeDomainData(timeData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const centered = (timeData[i] - 128) / 128;
        sumSq += centered * centered;
      }
      const rms = Math.min(1, Math.sqrt(sumSq / timeData.length) * 2.2);
      const history = historyRef.current;
      history.push(rms);
      if (history.length > canvas.width) history.shift();
      paintScrollingWave(g, canvas.width, canvas.height, history);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const finishUpload = async (chunks: Blob[]) => {
    if (uploadStartedRef.current) return;
    uploadStartedRef.current = true;

    const durationSec = recordedSecondsRef.current;

    const complete = (errMsg?: string) => {
      if (errMsg) setError(errMsg);
      setPhase('done');
      setRecordedSeconds(durationSec);
      onSavedRef.current(durationSec);
    };

    try {
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size > 0) {
          await Promise.race([
            uploadAttemptAudio(attemptId, item.questionCode, blob, sessionToken),
            new Promise<never>((_, reject) => {
              window.setTimeout(() => reject(new Error('UPLOAD_TIMEOUT')), 20_000);
            }),
          ]);
        }
      }
      complete();
    } catch (err) {
      complete(err instanceof ApiError ? err.message : t.test2.uploadFailed);
    }
  };

  const forceUnlock = () => {
    if (phaseRef.current !== 'saving') return;
    setPhase('done');
    setRecordedSeconds(recordedSecondsRef.current);
    onSavedRef.current(recordedSecondsRef.current);
  };

  const captureRecordedDuration = () => {
    if (recordStartedAtRef.current != null) {
      const elapsed = Math.round((Date.now() - recordStartedAtRef.current) / 1000);
      const duration = Math.max(0, Math.min(maxSeconds, elapsed));
      recordedSecondsRef.current = duration;
      setRecordedSeconds(duration);
      return duration;
    }
    recordedSecondsRef.current = 0;
    setRecordedSeconds(0);
    return 0;
  };

  const stopRecording = (upload = true) => {
    window.clearInterval(timerRef.current);
    freezeWave();
    const recorder = mediaRef.current;
    const wasRecording = recordingStartedRef.current && recorder && recorder.state !== 'inactive';
    if (wasRecording) captureRecordedDuration();

    if (!upload) {
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }
      cleanupCapture();
      return;
    }

    if (phaseRef.current === 'saving' || phaseRef.current === 'done') return;
    setPhase('saving');
    if (wasRecording) void playBeep('stop');

    const runUpload = () => {
      cleanupCapture();
      void finishUpload([...chunksRef.current]);
    };

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = runUpload;
      try {
        if (recorder.state === 'recording') {
          try {
            recorder.requestData();
          } catch {
            /* optional */
          }
        }
        recorder.stop();
      } catch {
        runUpload();
      }
      window.setTimeout(() => {
        if (phaseRef.current === 'saving' && !uploadStartedRef.current) runUpload();
      }, 8000);
      window.setTimeout(forceUnlock, 25_000);
    } else {
      runUpload();
      window.setTimeout(forceUnlock, 25_000);
    }
  };

  const startMediaRecorder = async () => {
    setError(null);
    try {
      let stream = streamRef.current;
      if (!stream || stream.getTracks().every((tr) => tr.readyState === 'ended')) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }
      void audioCtxRef.current?.close().catch(() => undefined);
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      setShowWave(true);
      requestAnimationFrame(() => drawScrollingAmplitude(analyser));

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mediaRef.current = recorder;
      recorder.start(250);
      recordingStartedRef.current = true;
      recordStartedAtRef.current = Date.now();
      setPhase('recording');
      setRecLeft(maxSeconds);
      timerRef.current = window.setInterval(() => {
        setRecLeft((s) => {
          if (s <= 1) {
            window.clearInterval(timerRef.current);
            queueMicrotask(() => stopRecording(true));
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      recordingKickoffRef.current = false;
      setError(t.test2.micAccessError);
      setPhase('ready');
      setShowWave(false);
    }
  };

  const beginRecording = async () => {
    if (recordingKickoffRef.current || finishingRef.current) return;
    if (
      phaseRef.current === 'saving' ||
      phaseRef.current === 'done' ||
      phaseRef.current === 'recording'
    ) {
      return;
    }
    recordingKickoffRef.current = true;
    try {
      // Start cue already played during the 3-2-1 arming window.
      await startMediaRecorder();
    } catch {
      recordingKickoffRef.current = false;
      setError(t.test2.micAccessError);
      setPhase('ready');
      setShowWave(false);
    }
  };

  const startArming = () => {
    setPhase('arming');
    setArmLeft(ARMING_SECONDS);
    // Do NOT open the mic during the start cue — an active capture stream makes
    // Chrome/Edge/Windows duck speaker volume (cue drops after ~1s).
  };

  useEffect(() => {
    if (phase !== 'arming') return undefined;
    setArmLeft(ARMING_SECONDS);
    let left = ARMING_SECONDS;
    let cancelled = false;
    let armAudio: HTMLAudioElement | null = null;

    // Use a local interval id — never timerRef. timerRef is owned by the recording
    // stopwatch; clearing it here when phase flips to 'recording' would kill auto-stop.
    const armTimerId = window.setInterval(() => {
      if (cancelled) return;
      left -= 1;
      setArmLeft(Math.max(0, left));
      if (left <= 0) window.clearInterval(armTimerId);
    }, 1000);

    void (async () => {
      const url = await resolveBeepUrl('start', sessionToken, beepCacheRef.current);
      if (cancelled) return;
      if (url) {
        await new Promise<void>((resolve) => {
          const audio = new Audio(url);
          armAudio = audio;
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          audio.onended = finish;
          audio.onerror = finish;
          void audio.play().catch(finish);
          window.setTimeout(finish, BEEP_PLAY_TIMEOUT_MS);
        });
      } else {
        await new Promise((r) => window.setTimeout(r, ARMING_SECONDS * 1000));
      }
      if (cancelled || finishingRef.current) return;
      window.clearInterval(armTimerId);
      setArmLeft(0);
      // Mic opens only now — after the cue has finished playing unducked.
      void beginRecording();
    })();

    return () => {
      cancelled = true;
      window.clearInterval(armTimerId);
      if (armAudio) {
        armAudio.pause();
        armAudio = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'prep' || prepSeconds <= 0) return undefined;
    setPrepLeft(prepSeconds);
    let left = prepSeconds;
    // Local prep timer — do not share timerRef with the recording stopwatch.
    const prepTimerId = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        window.clearInterval(prepTimerId);
        setPrepLeft(0);
        // All speaking tasks (incl. Task 8) share the same 3-2-1 + start cue.
        startArming();
        return;
      }
      setPrepLeft(left);
    }, 1000);
    return () => window.clearInterval(prepTimerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, prepSeconds]);

  const playPrompt = async () => {
    if (!audioUrl) {
      startArming();
      return;
    }
    setPhase('prompt');
    setShowWave(false);
    try {
      const url = await fetchAudioBlob(audioUrl, sessionToken);
      promptUrlRef.current = url;
      const audio = new Audio(url);
      promptAudioRef.current = audio;
      audio.onended = () => {
        promptAudioRef.current = null;
        if (promptUrlRef.current) {
          URL.revokeObjectURL(promptUrlRef.current);
          promptUrlRef.current = null;
        }
        startArming();
      };
      await audio.play();
    } catch {
      setError(t.test2.promptPlayError);
      setPhase('ready');
      setShowWave(false);
    }
  };

  const commit = async () => {
    const current = phaseRef.current;
    if (current === 'done' || current === 'ready' || alreadySaved) return;
    if (current === 'saving') {
      for (let i = 0; i < 40 && phaseRef.current === 'saving'; i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      return;
    }
    stopPromptAudio();
    window.clearInterval(timerRef.current);
    if (current === 'recording') {
      stopRecording(true);
      for (let i = 0; i < 40 && phaseRef.current === 'saving'; i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      return;
    }
    // prompt / prep / arming started → commit without usable audio (no start beep played into answer)
    cleanupCapture();
    setShowWave(false);
    setPhase('saving');
    await finishUpload([]);
  };

  useImperativeHandle(ref, () => ({ commit }), [alreadySaved]);

  const overlay = meta.overlay as
    | { type: 'list'; items: string[] }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | undefined;

  const showStaticSpeakTime =
    phase === 'ready' || phase === 'prompt' || phase === 'prep' || phase === 'arming';
  const showTickingSpeakTime = phase === 'recording';
  const savedLengthLabel =
    recordedSeconds > 0
      ? formatSpeakingDuration(recordedSeconds, t.test2.speakingDurationMinSec)
      : null;
  const statusMessage =
    phase === 'prompt'
      ? t.test2.listenToPrompt
      : phase === 'recording'
        ? t.test2.recordingLabel
        : phase === 'saving'
          ? t.test2.savingLabel
          : phase === 'done'
            ? savedLengthLabel
              ? t.test2.recordingSavedWithLength.replace('{time}', savedLengthLabel)
              : t.test2.recordingSavedNoAudio
            : null;

  return (
    <div className="select-none rounded-2xl border-2 border-slate-200 bg-white p-6">
      <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/90 px-5 py-4">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-bold text-slate-600 shadow-sm">
            {padQuestionNumber(item.canonicalNumber)}
          </span>
          <p className="flex-1 pt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 sm:text-base">
            {item.prompt}
          </p>
        </div>
      </div>

      {overlay?.type === 'list' ? (
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-edt-forest">
          {overlay.items.map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ol>
      ) : null}
      {overlay?.type === 'table' ? (
        <table className="mb-4 w-full text-left text-sm">
          <thead>
            <tr>
              {overlay.headers.map((h) => (
                <th key={h} className="border-b border-slate-200 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overlay.rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell) => (
                  <td key={cell} className="border-b border-slate-100 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {showStaticSpeakTime ? (
        <p className="mb-3 text-center text-sm font-semibold text-edt-olive">{speakTimeLabel}</p>
      ) : null}
      {showTickingSpeakTime ? (
        <p className="mb-3 text-center font-mono text-lg font-semibold tabular-nums text-edt-forest">
          {formatMinSec(recLeft)}
        </p>
      ) : null}

      {showWave ? (
        <canvas ref={canvasRef} width={640} height={96} className="mb-4 w-full rounded-lg bg-edt-forest" />
      ) : null}

      {phase === 'prep' ? (
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-edt-olive">
          {t.test2.prepTimeLabel}
        </p>
      ) : null}
      {phase === 'prep' ? (
        <p className="mb-4 text-center font-display text-4xl text-edt-gold">{formatTime(prepLeft)}</p>
      ) : null}

      {phase === 'arming' ? <ArmingCountdown seconds={armLeft} /> : null}

      {statusMessage ? (
        <p
          className={`mb-4 text-center text-lg font-semibold ${
            phase === 'recording'
              ? 'text-rose-700'
              : phase === 'done'
                ? 'text-emerald-700'
                : phase === 'saving'
                  ? 'text-edt-olive'
                  : 'text-edt-forest'
          }`}
        >
          {statusMessage}
        </p>
      ) : null}

      <div className="flex justify-center gap-3">
        {phase === 'ready' ? (
          <button
            type="button"
            onClick={() => {
              // Warm + release mic on this click so permission is ready after the
              // unducked 3-2-1 cue (mic must stay closed while the cue plays).
              void warmMicPermission().catch(() => undefined);
              void (prepSeconds > 0 ? setPhase('prep') : playPrompt());
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-edt-forest px-10 py-4 text-sm font-bold uppercase tracking-[0.12em] text-edt-neon hover:bg-[#243b37]"
          >
            {audioUrl ? t.test2.playPromptRecord : t.test2.startRecording}
          </button>
        ) : null}
        {phase === 'recording' ? (
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="rounded-xl bg-rose-700 px-10 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white"
          >
            {t.test2.stopRecording}
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-center text-sm text-rose-600">{error}</p> : null}
    </div>
  );
});


export function Test3QuizScreen({
  candidateInfo,
  session,
  onBack,
  onSubmit,
}: {
  candidateInfo: CandidateInfo;
  session: Session;
  onBack: () => void;
  onSubmit: (result: Test2Result) => void;
}) {
  const { t } = useLocale();
  const [gate, setGate] = useState(true);
  const [micOk, setMicOk] = useState(false);
  const [starting, setStarting] = useState(false);
  const [instance, setInstance] = useState<AttemptInstance | null>(null);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writingTexts, setWritingTexts] = useState<Record<string, string>>({});
  const [speakingDone, setSpeakingDone] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const sampleSoundRef = useRef<SampleSoundHandle>(null);
  const speakingRef = useRef<SpeakingRecorderHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  const leaveConfirmedRef = useRef(false);
  const submittingRef = useRef(false);
  /** True once POST /submit has been accepted (attempt may still be grading). */
  const serverAcceptedRef = useRef(false);
  const autoSubmitFiredRef = useRef(false);
  const handleSubmitRef = useRef<(auto?: boolean) => Promise<void>>(async () => {});

  const beginTest = async () => {
    if (starting || !micOk) return;
    setStarting(true);
    sampleSoundRef.current?.stop();
    try {
      setLoadError(null);
      const next = await startAttempt('03', { name: candidateInfo.name, id: candidateInfo.id }, session.sessionToken);
      setInstance(next);
      setTimeLeft(next.timeLimitSeconds);
      setGate(false);
    } catch (err) {
      setLoadError(
        err instanceof ApiError && err.code === 'NO_REMAINING_USES'
          ? t.test2.noRemainingError
          : err instanceof ApiError
            ? err.message
            : t.test2.startError,
      );
      setStarting(false);
    }
  };

  const items = instance?.items ?? [];
  const current = items[index];
  const inWriting = current?.responseType === 'writing' || current?.partCode === '02';

  const answeredCount = useMemo(() => {
    let n = 0;
    for (const item of items) {
      if (item.responseType === 'speaking') {
        if (speakingDone[item.questionCode] != null) n += 1;
      } else if ((writingTexts[item.questionCode] ?? '').trim().length > 0) {
        n += 1;
      }
    }
    return n;
  }, [items, speakingDone, writingTexts]);

  const skipped = items.slice(0, index).filter((item) => {
    if (item.responseType === 'speaking') return speakingDone[item.questionCode] == null;
    return (writingTexts[item.questionCode] ?? '').trim().length === 0;
  }).length;

  const passageRange = useMemo(() => {
    if (!current?.resourceId || !items.length) return null;
    const resourceId = current.resourceId;
    const positions = items
      .map((item, i) => (item.resourceId === resourceId ? i + 1 : null))
      .filter((position): position is number => position !== null);
    if (positions.length === 0) return null;
    return { from: Math.min(...positions), to: Math.max(...positions) };
  }, [current?.resourceId, items]);

  const handleSubmit = async (auto = false) => {
    if (submittingRef.current || !instance) return;
    submittingRef.current = true;
    if (timerRef.current) window.clearInterval(timerRef.current);
    setShowModal(false);
    setSubmitting(true);
    setSubmitError(false);
    try {
      // Flush writing answers before submit. If the attempt is already completed
      // (retry after a prior successful submit / race with timer), skip 409s and
      // continue — POST /submit is idempotent and returns the stored report.
      if (!serverAcceptedRef.current) {
        for (const item of items.filter((i) => i.responseType === 'writing')) {
          const text = writingTexts[item.questionCode] ?? '';
          try {
            await saveAttemptTextAnswer(instance.attemptId, item.questionCode, text, session.sessionToken);
          } catch (err) {
            if (err instanceof ApiError && err.code === 'ATTEMPT_COMPLETED') {
              serverAcceptedRef.current = true;
              break;
            }
            throw err;
          }
        }
      }
      let report = await submitAttempt(
        instance.attemptId,
        { name: candidateInfo.name, id: candidateInfo.id },
        auto,
        session.sessionToken,
      );
      serverAcceptedRef.current = true;
      for (let i = 0; i < 40 && report.gradingStatus === 'pending'; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        report = await fetchAttemptReport(instance.attemptId, session.sessionToken);
      }
      if (report.gradingStatus === 'pending' || report.gradingStatus === 'failed' || !report.variables) {
        throw new Error('GRADING_INCOMPLETE');
      }
      leaveConfirmedRef.current = true;
      onSubmit({
        attemptId: instance.attemptId,
        variables: report.variables,
        review: report.review,
        gradingStatus: report.gradingStatus,
      });
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitError(true);
    }
  };
  handleSubmitRef.current = handleSubmit;

  const confirmLeave = useCallback(() => {
    leaveConfirmedRef.current = true;
    setShowLeaveModal(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    onBack();
  }, [onBack]);

  useEffect(() => {
    if (timeLeft === null) return undefined;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((time) => {
        if (time === null) return time;
        if (time <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          return 0;
        }
        return time - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft !== null]);

  // Auto-submit when the countdown hits zero (side effect kept out of setState).
  useEffect(() => {
    if (timeLeft !== 0 || autoSubmitFiredRef.current || submittingRef.current) return;
    autoSubmitFiredRef.current = true;
    void handleSubmitRef.current(true);
  }, [timeLeft]);

  useEffect(() => {
    history.pushState({ quiz: true }, '');
    const onPopState = () => {
      if (leaveConfirmedRef.current) return;
      history.pushState({ quiz: true }, '');
      setShowLeaveModal(true);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaveConfirmedRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  const secondsLeft = timeLeft ?? instance?.timeLimitSeconds ?? 3600;
  const timerCls =
    secondsLeft <= 120 ? 'timer-critical text-rose-400' : secondsLeft <= 300 ? 'font-bold text-edt-gold' : 'font-bold text-edt-neon';
  const progress = items.length > 0 ? ((index + 1) / items.length) * 100 : 0;
  const progressRounded = Math.round(progress);
  const quizNavButtonClass =
    'rounded-xl border-2 border-sky-300 bg-sky-50 px-8 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-sky-800 transition-colors hover:border-edt-green hover:bg-edt-green hover:text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-50';
  const submitButtonClass =
    'rounded-xl bg-edt-gold px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-edt-forest transition-all hover:bg-edt-neon hover:shadow-neon disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-2.5 sm:text-sm';
  const navLocked = submitting || taskBusy;
  const openSubmitConfirm = () => setShowModal(true);

  const leaveCurrentSpeaking = async () => {
    if (current?.responseType === 'speaking') {
      await speakingRef.current?.commit();
    }
  };

  const goPrev = () => {
    if (!current || !instance || index === 0 || navLocked) return;
    void (async () => {
      await leaveCurrentSpeaking();
      if (current.responseType === 'writing') {
        void saveAttemptTextAnswer(
          instance.attemptId,
          current.questionCode,
          writingTexts[current.questionCode] ?? '',
          session.sessionToken,
        ).catch(() => {});
      }
      setIndex((i) => Math.max(0, i - 1));
    })();
  };

  const goNext = () => {
    if (!current || !instance || navLocked) return;
    void (async () => {
      await leaveCurrentSpeaking();
      if (current.responseType === 'writing') {
        void saveAttemptTextAnswer(
          instance.attemptId,
          current.questionCode,
          writingTexts[current.questionCode] ?? '',
          session.sessionToken,
        ).catch(() => {});
      }
      setIndex((i) => Math.min(items.length - 1, i + 1));
    })();
  };

  const copyGuardProps = {
    onCopy: blockCopyInteraction,
    onCut: blockCopyInteraction,
    onContextMenu: blockCopyInteraction,
  };

  const blockDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  if (gate) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans">
        <header className="sticky top-0 z-30 border-b border-[rgba(130,129,109,0.2)] bg-edt-forest no-print">
          <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveModal(true)}
                className="flex-shrink-0 text-sm font-semibold text-edt-olive transition-colors hover:text-edt-soft"
              >
                ← {t.nav.back}
              </button>
              <div className="min-w-0 border-l border-edt-olive/40 pl-3">
                <h1 className="truncate font-display text-lg font-bold leading-tight text-edt-soft md:text-xl">
                  {t.test2.paper3QuizTitle}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1200px] items-center justify-center px-4 py-10 md:px-6">
          <div className="w-full max-w-2xl rounded-2xl border-2 border-slate-200 bg-white p-8 text-center md:p-10">
            <section>
              <h2 className="mb-4 text-xl font-extrabold uppercase tracking-[0.12em] text-edt-forest">
                {t.test2.audioCheckTitle}
              </h2>
              <p className="mx-auto mb-8 max-w-lg text-sm leading-relaxed text-slate-600">
                {t.test2.paper3AudioCheckBody}
              </p>
              <SampleSoundButton ref={sampleSoundRef} sessionToken={session.sessionToken} />
              <p className="mt-3 text-xs text-edt-olive">{t.test2.audioCheckReplayNote}</p>
            </section>

            <div className="my-10 border-t border-slate-100" />

            <MicCheckPanel
              sessionToken={session.sessionToken}
              onOk={setMicOk}
              onStartRecording={() => sampleSoundRef.current?.stop()}
            />

            <div className="mx-auto my-8 max-w-lg space-y-2 border-t border-slate-100 pt-6 text-left">
              <p className="text-sm leading-relaxed text-edt-forest">{t.test2.paper3GateSpeaking}</p>
              <p className="text-sm leading-relaxed text-edt-forest">{t.test2.paper3GateWriting}</p>
              <p className="text-sm leading-relaxed text-slate-500">{t.test2.audioCheckTimerNote}</p>
            </div>

            {loadError ? <p className="mb-4 text-sm text-rose-600">{loadError}</p> : null}
            <button
              type="button"
              disabled={!micOk || starting}
              onClick={() => void beginTest()}
              className="rounded-xl bg-edt-gold px-12 py-3.5 text-sm font-bold uppercase tracking-[0.1em] text-edt-forest transition-all hover:bg-edt-neon hover:shadow-neon disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting ? t.test2.loading : t.test2.audioCheckStart}
            </button>
          </div>
        </main>

        {showLeaveModal ? <LeavePageModal onConfirm={confirmLeave} onCancel={() => setShowLeaveModal(false)} /> : null}
      </div>
    );
  }

  if (!instance || !current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-edt-forest/20 border-t-edt-forest" />
          <p className="text-sm font-semibold text-slate-500">{loadError ?? t.test2.loading}</p>
        </div>
      </div>
    );
  }

  const resource = current.resourceId != null ? instance.resources[current.resourceId] : null;

  return (
    <div
      className="min-h-screen select-none bg-slate-50 font-sans"
      {...copyGuardProps}
      onDragOver={blockDrop}
      onDrop={blockDrop}
    >
      <header className="sticky top-0 z-30 border-b border-[rgba(130,129,109,0.2)] bg-edt-forest no-print">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              className="flex-shrink-0 text-sm font-semibold text-edt-olive transition-colors hover:text-edt-soft"
            >
              ← {t.nav.back}
            </button>
            <div className="min-w-0 border-l border-edt-olive/40 pl-3">
              <h1 className="truncate font-display text-lg font-bold leading-tight text-edt-soft md:text-xl">
                {t.test2.paper3QuizTitle}
              </h1>
              <p className="truncate text-xs text-edt-olive">
                {inWriting ? t.test2.partBWriting : t.test2.partASpeaking} · Task{' '}
                {padQuestionNumber(current.canonicalNumber)}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3 sm:gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-edt-olive sm:text-sm">
                {t.quiz.timeRemain}
              </span>
              <span className={`font-mono text-xl tabular-nums ${timerCls}`}>{formatTime(secondsLeft)}</span>
            </div>
            <button type="button" onClick={openSubmitConfirm} disabled={navLocked} className={submitButtonClass}>
              {submitting ? t.quiz.submitting : t.quiz.submitNow}
            </button>
          </div>
        </div>

        <div
          className="relative h-8 bg-edt-indigo"
          role="progressbar"
          aria-valuenow={progressRounded}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="absolute inset-y-0 left-0 bg-edt-green transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
          <span className="relative z-10 flex h-full items-center justify-center text-xs font-semibold tracking-wide text-white drop-shadow-sm sm:text-sm">
            {t.quiz.currentProgress} {progressRounded}%
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
        {submitError ? (
          <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row">
            <span>{t.test2.submitError}</span>
            <button
              type="button"
              onClick={() => void handleSubmit(false)}
              className="rounded-xl bg-edt-forest px-5 py-2 text-xs font-bold uppercase tracking-[0.08em] text-edt-neon"
            >
              {t.test2.retry}
            </button>
          </div>
        ) : null}

        {submitting ? (
          <div className="mt-5 rounded-2xl border-2 border-edt-gold/40 bg-edt-forest px-6 py-5 text-center shadow-sm">
            <p className="text-sm font-semibold leading-relaxed text-edt-neon sm:text-base">
              {t.test2.processingSubmitWait}
            </p>
          </div>
        ) : null}

        <div className="mt-5">
          {current.responseType === 'speaking' ? (
            <SpeakingRecorder
              ref={speakingRef}
              key={current.questionCode}
              item={current}
              audioUrl={resource?.type === 'audio' ? resource.url : null}
              sessionToken={session.sessionToken}
              attemptId={instance.attemptId}
              alreadySaved={speakingDone[current.questionCode] != null}
              savedDurationSec={speakingDone[current.questionCode] ?? 0}
              onBusyChange={setTaskBusy}
              onSaved={(durationSec) => {
                setSpeakingDone((prev) => ({ ...prev, [current.questionCode]: durationSec }));
              }}
            />
          ) : (
            <div className="select-none rounded-2xl border-2 border-slate-200 bg-white p-6">
              <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/90 px-5 py-4">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-bold text-slate-600 shadow-sm">
                    {padQuestionNumber(current.canonicalNumber)}
                  </span>
                  <div className="flex-1 pt-1.5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 sm:text-base">
                      {current.prompt}
                    </p>
                    {current.meta?.guidelines ? (
                      <p className="mt-3 text-xs leading-relaxed text-edt-olive">{current.meta.guidelines}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              {resource?.type === 'text' && passageRange ? (
                <div className="mb-4">
                  <PassageViewer
                    key={resource.resourceId}
                    questionFrom={passageRange.from}
                    questionTo={passageRange.to}
                    content={resource.content}
                  />
                </div>
              ) : null}
              <textarea
                value={writingTexts[current.questionCode] ?? ''}
                onChange={(e) =>
                  setWritingTexts((prev) => ({ ...prev, [current.questionCode]: e.target.value }))
                }
                onContextMenu={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onDragOver={blockDrop}
                onDrop={blockDrop}
                rows={14}
                disabled={navLocked}
                className="w-full select-none rounded-xl border-2 border-slate-200 p-4 text-sm leading-relaxed text-slate-800 outline-none focus:border-edt-gold disabled:opacity-60"
                placeholder={t.test2.writingPlaceholder}
              />
              <p className="mt-2 text-xs text-edt-olive">
                {t.test2.wordCountLabel}: {wordCount(writingTexts[current.questionCode] ?? '')}
                {current.meta?.wordMin && current.meta?.wordMax
                  ? ` (aim ${current.meta.wordMin}–${current.meta.wordMax})`
                  : ''}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col items-stretch gap-3 rounded-2xl border-2 border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0 || navLocked}
            className={quizNavButtonClass}
          >
            {t.quiz.previous}
          </button>

          <div className="text-center sm:flex-1">
            <p className="text-sm font-semibold text-black md:text-base">
              {t.quiz.currentQuestionReminder} {index + 1} / {items.length}
            </p>
            {skipped > 0 ? (
              <p className="mt-1 text-sm font-medium text-amber-700 md:text-base">
                {t.quiz.skippedPrefix} {skipped} {t.quiz.skippedSuffix}
              </p>
            ) : null}
          </div>

          {index === items.length - 1 ? (
            <button
              type="button"
              onClick={openSubmitConfirm}
              disabled={navLocked}
              className={`${submitButtonClass} px-8 py-3 text-sm`}
            >
              {submitting ? t.quiz.submitting : t.quiz.submit}
            </button>
          ) : (
            <button type="button" onClick={goNext} disabled={navLocked} className={quizNavButtonClass}>
              {t.quiz.next}
            </button>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-[rgba(170,169,90,0.35)] bg-white p-3 text-xs leading-snug text-edt-forest sm:text-sm">
          <p>
            <span className="font-semibold text-edt-forest">{t.quiz.instructionsIntroLabel} </span>
            {t.test2.paper3InstructionsIntro}
          </p>
          <p className="mt-1.5">
            <span className="font-semibold text-edt-forest">{t.quiz.instructionsNavLabel} </span>
            {t.test2.paper3InstructionsNav}
          </p>
          <p className="mt-1.5">
            <span className="font-semibold text-edt-forest">{t.quiz.instructionsSubmitLabel} </span>
            {t.test2.paper3InstructionsSubmit}
          </p>
        </div>
      </main>

      {showModal && !submitting ? (
        <ConfirmModal
          answeredCount={answeredCount}
          total={items.length}
          onConfirm={() => void handleSubmit(false)}
          onCancel={() => setShowModal(false)}
        />
      ) : null}
      {showLeaveModal ? <LeavePageModal onConfirm={confirmLeave} onCancel={() => setShowLeaveModal(false)} /> : null}
    </div>
  );
}

