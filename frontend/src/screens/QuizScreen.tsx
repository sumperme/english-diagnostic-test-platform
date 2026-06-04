import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { QuestionCard } from '../components/QuestionCard';
import { ALL_QUESTIONS, type OptionKey, type Question } from '../data/questions';
import { useLocale } from '../i18n/LocaleContext';
import { submitReport } from '../lib/api';
import { formatTime } from '../lib/format';
import { computeReport, TOTAL_SECS } from '../lib/scoring';
import { shuffle } from '../lib/shuffle';
import type { Answers, CandidateInfo, ReportResult, Session } from '../types';

export function QuizScreen({
  candidateInfo,
  session,
  onSubmit,
}: {
  candidateInfo: CandidateInfo;
  session: Session;
  onSubmit: (result: ReportResult) => void;
}) {
  const { t } = useLocale();
  const [answers, setAnswers] = useState<Answers>({});
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const timerRef = useRef<number | null>(null);
  const shuffledQuestions = useMemo<Question[]>(() => shuffle(ALL_QUESTIONS), []);
  const currentQuestion = shuffledQuestions[currentIndex];
  const answered = Object.values(answers).filter(Boolean).length;

  const handleSubmit = async (auto = false) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setShowModal(false);
    setSubmitting(true);
    const result = computeReport(answers, candidateInfo, startedAt.current, auto, shuffledQuestions);

    try {
      result.backendData = await submitReport(result, session.sessionToken);
    } catch {
      result.backendError = true;
    }

    setSubmitting(false);
    onSubmit(result);
  };

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setTimeLeft((time) => {
        if (time <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          void handleSubmit(true);
          return 0;
        }
        return time - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const selectAnswer = (key: OptionKey) => {
    setAnswers((previous) => ({ ...previous, [currentQuestion.id]: key }));
  };

  const timerCls = timeLeft <= 120 ? 'timer-critical text-rose-500' : timeLeft <= 300 ? 'font-bold text-amber-500' : 'font-bold text-sky-600';
  const progress = ((currentIndex + 1) / shuffledQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm no-print">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight text-slate-800">{t.quiz.title}</h1>
            <p className="text-xs text-slate-400">
              {t.quiz.question} {currentIndex + 1} / {shuffledQuestions.length} - {answered} / {shuffledQuestions.length} {t.quiz.answered}
            </p>
          </div>
          <span className={`font-mono text-xl tabular-nums ${timerCls}`}>{formatTime(timeLeft)}</span>
        </div>
        <div className="h-1 bg-slate-100">
          <div className="h-1 bg-sky-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-relaxed text-sky-800">
          {t.quiz.instructions}
        </div>

        <QuestionCard
          q={currentQuestion}
          selected={answers[currentQuestion.id]}
          onSelect={selectAnswer}
          preventCopy
        />

        <div className="mt-8 flex flex-col justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white p-5 sm:flex-row">
          <button
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex === 0 || submitting}
            className="rounded-xl border-2 border-slate-200 px-6 py-3 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.quiz.previous}
          </button>
          {currentIndex === shuffledQuestions.length - 1 ? (
            <button
              onClick={() => setShowModal(true)}
              disabled={submitting}
              className="rounded-xl bg-sky-500 px-8 py-3 font-bold text-white shadow-lg shadow-sky-200 transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {submitting ? t.quiz.submitting : t.quiz.submit}
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((index) => Math.min(shuffledQuestions.length - 1, index + 1))}
              disabled={submitting}
              className="rounded-xl bg-sky-500 px-8 py-3 font-bold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {t.quiz.next}
            </button>
          )}
        </div>
      </main>

      {showModal && !submitting ? (
        <ConfirmModal answeredCount={answered} total={shuffledQuestions.length} onConfirm={() => void handleSubmit(false)} onCancel={() => setShowModal(false)} />
      ) : null}
    </div>
  );
}
