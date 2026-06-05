import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmModal } from '../components/ConfirmModal';

import { LeavePageModal } from '../components/LeavePageModal';

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

  onBack,

  onSubmit,

}: {

  candidateInfo: CandidateInfo;

  session: Session;

  onBack: () => void;

  onSubmit: (result: ReportResult) => void;

}) {

  const { t } = useLocale();

  const [answers, setAnswers] = useState<Answers>({});

  const [timeLeft, setTimeLeft] = useState(TOTAL_SECS);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [showModal, setShowModal] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const startedAt = useRef(Date.now());

  const timerRef = useRef<number | null>(null);

  const leaveConfirmedRef = useRef(false);

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



    leaveConfirmedRef.current = true;

    setSubmitting(false);

    onSubmit(result);

  };



  const confirmLeave = useCallback(() => {

    leaveConfirmedRef.current = true;

    setShowLeaveModal(false);

    if (timerRef.current) window.clearInterval(timerRef.current);

    onBack();

  }, [onBack]);



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

    setAnswers((previous) => ({ ...previous, [currentQuestion.id]: key }));

  };



  const timerCls =

    timeLeft <= 120 ? 'timer-critical text-rose-400' : timeLeft <= 300 ? 'font-bold text-edt-gold' : 'font-bold text-edt-neon';

  const progress = ((currentIndex + 1) / shuffledQuestions.length) * 100;

  const quizNavButtonClass =
    'rounded-xl border-2 border-sky-300 bg-sky-50 px-8 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-sky-800 transition-colors hover:border-edt-green hover:bg-edt-green hover:text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-50';

  const submitButtonClass =
    'rounded-xl bg-edt-gold px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-edt-forest transition-all hover:bg-edt-neon hover:shadow-neon disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-2.5 sm:text-sm';

  const openSubmitConfirm = () => setShowModal(true);

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
            <span className={`font-mono text-xl tabular-nums ${timerCls}`}>{formatTime(timeLeft)}</span>
            <button
              type="button"
              onClick={openSubmitConfirm}
              disabled={submitting}
              className={submitButtonClass}
            >
              {submitting ? t.quiz.submitting : t.quiz.submitNow}
            </button>
          </div>

        </div>

        <div className="h-1 bg-edt-indigo">

          <div className="h-1 bg-edt-green transition-all duration-300" style={{ width: `${progress}%` }} />

        </div>

      </header>



      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-6">

        <div className="mb-8 rounded-2xl border border-[rgba(170,169,90,0.35)] bg-white p-5 text-sm leading-relaxed text-edt-forest">

          {t.quiz.instructions}

        </div>



        <div className="mt-5">
          <QuestionCard
            q={currentQuestion}
            displayNumber={currentIndex + 1}
            selected={answers[currentQuestion.id]}
            onSelect={selectAnswer}
            preventCopy
          />
        </div>



        <div className="mt-8 flex flex-col items-stretch gap-3 rounded-2xl border-2 border-slate-200 bg-white p-5 sm:flex-row sm:items-center">

          <button
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex === 0 || submitting}
            className={quizNavButtonClass}
          >
            {t.quiz.previous}
          </button>

          <p className="text-center text-sm font-medium text-slate-600 sm:flex-1 md:text-base">
            {t.quiz.question} {currentIndex + 1} / {shuffledQuestions.length} - {answered} / {shuffledQuestions.length}{' '}
            {t.quiz.answered}
          </p>

          {currentIndex === shuffledQuestions.length - 1 ? (

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
              onClick={() => setCurrentIndex((index) => Math.min(shuffledQuestions.length - 1, index + 1))}
              disabled={submitting}
              className={quizNavButtonClass}
            >
              {t.quiz.next}
            </button>

          )}

        </div>

      </main>



      {showModal && !submitting ? (

        <ConfirmModal answeredCount={answered} total={shuffledQuestions.length} onConfirm={() => void handleSubmit(false)} onCancel={() => setShowModal(false)} />

      ) : null}

      {showLeaveModal ? <LeavePageModal onConfirm={confirmLeave} onCancel={() => setShowLeaveModal(false)} /> : null}

    </div>

  );

}

