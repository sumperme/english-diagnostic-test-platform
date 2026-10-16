import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { LeavePageModal } from '../components/LeavePageModal';
import { QuestionCard } from '../components/QuestionCard';
import type { OptionKey, Question } from '../data/questions';
import { useLocale } from '../i18n/LocaleContext';
import { ApiError, saveAttemptAnswer, startAttempt, submitAttempt } from '../lib/api';
import { formatTime } from '../lib/format';
import type { AttemptInstance, AttemptItem, CandidateInfo, Session, Test2Result } from '../types';

/** Paper I quiz: attempts API, random Part A variants, Part B in canonical order. */
export function QuizScreen({
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
  const [instance, setInstance] = useState<AttemptInstance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const timerRef = useRef<number | null>(null);
  const leaveConfirmedRef = useRef(false);
  const submittingRef = useRef(false);
  const startedRef = useRef(false);
  const handleSubmitRef = useRef<(auto?: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startAttempt('01', { name: candidateInfo.name, id: candidateInfo.id }, session.sessionToken)
      .then((nextInstance) => {
        setInstance(nextInstance);
        setTimeLeft(nextInstance.timeLimitSeconds);
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof ApiError && error.code === 'NO_REMAINING_USES'
            ? t.test2.noRemainingError
            : t.test2.startError,
        );
      });
  }, [candidateInfo.id, candidateInfo.name, session.sessionToken, t.test2.noRemainingError, t.test2.startError]);

  const items = instance?.items ?? [];
  const currentItem: AttemptItem | undefined = items[currentIndex];
  const answered = Object.values(answers).filter(Boolean).length;
  const skipped = items.slice(0, currentIndex).filter((item) => !answers[item.questionCode]).length;

  const handleSubmit = async (auto = false) => {
    if (submittingRef.current || !instance) return;
    submittingRef.current = true;
    if (timerRef.current) window.clearInterval(timerRef.current);
    setShowModal(false);
    setSubmitting(true);
    setSubmitError(false);

    try {
      const payload = await submitAttempt(
        instance.attemptId,
        { name: candidateInfo.name, id: candidateInfo.id },
        auto,
        session.sessionToken,
      );
      leaveConfirmedRef.current = true;
      onSubmit({ ...payload, attemptId: instance.attemptId });
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
          void handleSubmitRef.current(true);
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

  const selectAnswer = (key: OptionKey) => {
    if (!instance || !currentItem) return;
    setAnswers((previous) => ({ ...previous, [currentItem.questionCode]: key }));
    void saveAttemptAnswer(instance.attemptId, currentItem.questionCode, key, session.sessionToken).catch(() => {});
  };

  const currentQuestion: Question | null = useMemo(() => {
    if (!currentItem) return null;
    return {
      id: currentItem.questionCode,
      canonicalNumber: currentItem.canonicalNumber,
      part: currentItem.partCode === '01' ? 'A' : 'B',
      text: currentItem.prompt,
      opts: (['A', 'B', 'C', 'D'] as OptionKey[]).map((k) => ({ k, t: currentItem.options[k] })),
    };
  }, [currentItem]);

  const secondsLeft = timeLeft ?? instance?.timeLimitSeconds ?? 3600;
  const timerCls =
    secondsLeft <= 120 ? 'timer-critical text-rose-400' : secondsLeft <= 300 ? 'font-bold text-edt-gold' : 'font-bold text-edt-neon';
  const progress = items.length > 0 ? ((currentIndex + 1) / items.length) * 100 : 0;
  const progressRounded = Math.round(progress);
  const quizNavButtonClass =
    'rounded-xl border-2 border-sky-300 bg-sky-50 px-8 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-sky-800 transition-colors hover:border-edt-green hover:bg-edt-green hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400';
  const submitButtonClass =
    'rounded-xl bg-edt-gold px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-edt-forest transition-all hover:bg-edt-neon hover:shadow-neon disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-2.5 sm:text-sm';
  const openSubmitConfirm = () => setShowModal(true);

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center">
          <p className="mb-6 text-sm leading-relaxed text-rose-700">{loadError}</p>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl bg-edt-forest px-6 py-3 text-sm font-semibold text-edt-neon transition-colors hover:bg-[#243b37]"
          >
            ← {t.nav.back}
          </button>
        </div>
      </div>
    );
  }

  if (!instance || !currentItem || !currentQuestion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-edt-forest/20 border-t-edt-forest" />
          <p className="text-sm font-semibold text-slate-500">{t.test2.loading}</p>
        </div>
      </div>
    );
  }

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
              <h1 className="truncate font-display text-lg font-bold leading-tight text-edt-soft md:text-xl">{t.quiz.title}</h1>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3 sm:gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-edt-olive sm:text-sm">
                {t.quiz.timeRemain}
              </span>
              <span className={`font-mono text-xl tabular-nums ${timerCls}`}>{formatTime(secondsLeft)}</span>
            </div>
            <button type="button" onClick={openSubmitConfirm} disabled={submitting} className={submitButtonClass}>
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
          <div className="absolute inset-y-0 left-0 bg-edt-green transition-all duration-300" style={{ width: `${progress}%` }} />
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

        <div className="mt-5">
          <QuestionCard
            q={currentQuestion}
            displayNumber={currentIndex + 1}
            selected={answers[currentItem.questionCode]}
            onSelect={selectAnswer}
            preventCopy
          />
        </div>

        <div className="mt-5 flex flex-col items-stretch gap-3 rounded-2xl border-2 border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
          <button
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex === 0 || submitting}
            className={quizNavButtonClass}
          >
            {t.quiz.previous}
          </button>

          <div className="text-center sm:flex-1">
            <p className="text-sm font-semibold text-black md:text-base">
              {t.quiz.currentQuestionReminder} {currentIndex + 1} / {items.length}
            </p>
            {skipped > 0 ? (
              <p className="mt-1 text-sm font-medium text-amber-700 md:text-base">
                {t.quiz.skippedPrefix} {skipped} {t.quiz.skippedSuffix}
              </p>
            ) : null}
          </div>

          {currentIndex === items.length - 1 ? (
            <button
              type="button"
              onClick={openSubmitConfirm}
              disabled={submitting}
              className={`${submitButtonClass} px-8 py-3 text-sm`}
            >
              {submitting ? t.quiz.submitting : t.quiz.submit}
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((index) => Math.min(items.length - 1, index + 1))}
              disabled={submitting}
              className={quizNavButtonClass}
            >
              {t.quiz.next}
            </button>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-[rgba(170,169,90,0.35)] bg-white p-3 text-xs leading-snug text-edt-forest sm:text-sm">
          <p>
            <span className="font-semibold text-edt-forest">{t.quiz.instructionsIntroLabel} </span>
            {t.quiz.instructionsIntro}
          </p>
          <p className="mt-1.5">
            <span className="font-semibold text-edt-forest">{t.quiz.instructionsNavLabel} </span>
            {t.quiz.instructionsNav}
          </p>
          <p className="mt-1.5">
            <span className="font-semibold text-edt-forest">{t.quiz.instructionsSubmitLabel} </span>
            {t.quiz.instructionsSubmit}
          </p>
        </div>
      </main>

      {showModal && !submitting ? (
        <ConfirmModal
          answeredCount={answered}
          total={items.length}
          onConfirm={() => void handleSubmit(false)}
          onCancel={() => setShowModal(false)}
        />
      ) : null}
      {showLeaveModal ? <LeavePageModal onConfirm={confirmLeave} onCancel={() => setShowLeaveModal(false)} /> : null}
    </div>
  );
}
