import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '../i18n/LocaleContext';
import { fetchAiFeedback, startAiFeedback } from '../lib/api';
import type { AiFeedback, AiFeedbackStatus } from '../types';

const POLL_INTERVAL_MS = 2500;
const LOADING_LINE_INTERVAL_MS = 4000;

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2l1.7 4.3L16 8l-4.3 1.7L10 14l-1.7-4.3L4 8l4.3-1.7L10 2z" />
      <path d="M16.5 12.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" opacity="0.7" />
    </svg>
  );
}

/** Rotating status line + bouncing dots inside an EDT-styled loading card. */
function LoadingCard() {
  const { t } = useLocale();
  const lines = t.report.aiLoadingLines;
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setLineIndex((index) => (index + 1) % lines.length),
      LOADING_LINE_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [lines.length]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-edt-indigo/25 bg-white p-8 text-center">
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden">
        <div className="h-full w-full animate-pulse bg-gradient-to-r from-edt-indigo via-edt-neon to-edt-indigo" />
      </div>
      <div className="mb-4 flex items-center justify-center gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-edt-indigo" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-edt-gold [animation-delay:150ms]" />
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-edt-indigo [animation-delay:300ms]" />
      </div>
      <p className="text-sm font-semibold text-edt-indigo transition-opacity duration-500">{lines[lineIndex]}</p>
    </div>
  );
}

/** Feedback text follows a fixed "Label: content" line template — render each line with a bold label. */
export function FeedbackBody({ content }: { content: string }) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2.5 text-left">
      {lines.map((line, index) => {
        const separator = line.includes('：') ? '：' : ':';
        const separatorAt = line.indexOf(separator);
        const label = separatorAt > 0 && separatorAt <= 24 ? line.slice(0, separatorAt) : null;
        const body = label ? line.slice(separatorAt + 1).trim() : line;
        return (
          <p key={index} className="text-sm leading-relaxed text-slate-700">
            {label ? <span className="font-bold text-edt-forest">{label}{separator} </span> : null}
            {body}
          </p>
        );
      })}
    </div>
  );
}

/**
 * AI feedback section + centered action row for both papers' result screens.
 * The section is hidden until the candidate clicks Generate (or a feedback
 * already exists); generation is permanently one-per-attempt.
 */
export function AiFeedbackSection({
  attemptId,
  sessionToken,
  downloadButton,
}: {
  attemptId: string;
  sessionToken: string;
  downloadButton: ReactNode;
}) {
  const { t, language } = useLocale();
  const [status, setStatus] = useState<AiFeedbackStatus>('none');
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [revealed, setRevealed] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyResponse = useCallback(
    (nextStatus: AiFeedbackStatus, nextFeedback: AiFeedback | null) => {
      setStatus(nextStatus);
      if (nextFeedback) setFeedback(nextFeedback);
      if (nextStatus === 'done' || nextStatus === 'failed') {
        if (nextStatus === 'done') setRevealed(true);
        stopPolling();
      }
    },
    [stopPolling],
  );

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => {
      fetchAiFeedback(attemptId, sessionToken)
        .then((response) => applyResponse(response.status, response.feedback))
        .catch(() => {
          // Transient poll failure: keep polling; the stale-claim guard on the
          // server eventually reports 'failed'.
        });
    }, POLL_INTERVAL_MS);
  }, [attemptId, sessionToken, applyResponse, stopPolling]);

  // Restore state on mount so an already-generated feedback shows immediately
  // and the button starts disabled.
  useEffect(() => {
    let cancelled = false;
    fetchAiFeedback(attemptId, sessionToken)
      .then((response) => {
        if (cancelled) return;
        applyResponse(response.status, response.feedback);
        if (response.status === 'pending') {
          setRevealed(true);
          startPolling();
        }
      })
      .catch(() => {
        // No stored state — leave the button enabled.
      });
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const generate = async () => {
    if (status === 'pending' || status === 'done') return;
    setRevealed(true);
    setStatus('pending');
    try {
      const response = await startAiFeedback(attemptId, sessionToken);
      applyResponse(response.status, response.feedback);
      if (response.status === 'pending') startPolling();
    } catch {
      setStatus('failed');
    }
  };

  const localizedFeedback = feedback ? (language === 'zh-HK' ? feedback.zhHK : feedback.en) : null;
  const generateDisabled = status === 'pending' || status === 'done';

  return (
    <div className="space-y-5">
      {/* AI feedback section: hidden until first interaction */}
      {revealed ? (
        <section className="mx-auto w-full max-w-5xl">
          <h3 className="mb-3 flex items-center justify-center gap-2 text-center text-xs font-bold uppercase tracking-widest text-edt-indigo">
            <SparkleIcon className="h-4 w-4" />
            {t.report.aiSectionTitle}
          </h3>

          {status === 'pending' ? <LoadingCard /> : null}

          {status === 'done' && localizedFeedback ? (
            <div className="rounded-2xl border border-edt-indigo/25 bg-white p-6">
              <FeedbackBody content={localizedFeedback} />
              <p className="mt-4 border-t border-slate-100 pt-3 text-center text-[11px] text-slate-400">
                {t.report.aiDisclaimer}
              </p>
            </div>
          ) : null}

          {status === 'failed' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
              <p className="text-sm leading-relaxed text-amber-800">{t.report.aiFailed}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Centered action row: [Generate AI Feedback] [Download PDF] */}
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <span className="group relative inline-flex">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generateDisabled}
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
              status === 'done'
                ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                : status === 'pending'
                  ? 'cursor-wait bg-edt-indigo/70 text-white'
                  : 'bg-edt-indigo text-white hover:bg-[#4f4e7d] hover:shadow-md active:scale-95'
            }`}
          >
            <SparkleIcon className="h-4 w-4" />
            {status === 'pending' ? t.report.aiGenerating : t.report.aiGenerate}
          </button>
          {status === 'done' ? (
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-edt-forest px-3 py-1.5 text-[11px] font-medium text-edt-soft opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
            >
              {t.report.aiTooltipOnce}
            </span>
          ) : null}
        </span>
        {downloadButton}
      </div>
    </div>
  );
}
