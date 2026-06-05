import { useRef, useState } from 'react';
import { EdtNavBar } from '../components/EdtNavBar';
import { RadarChart } from '../components/RadarChart';
import { ANSWER_KEY, PART_A, PART_B } from '../data/questions';
import { useLocale } from '../i18n/LocaleContext';
import { downloadReportPdf } from '../lib/pdf';
import { formatDate } from '../lib/format';
import { levelBadgeClass, scoreBarColor } from '../lib/scoring';
import type { ReportResult } from '../types';

type Filter = 'all' | 'incorrect' | 'unanswered';

function ReviewSection({
  title,
  questions,
  result,
}: {
  title: string;
  questions: Array<(typeof PART_A)[number]>;
  result: ReportResult;
}) {
  const { t } = useLocale();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <span className="text-sm font-bold text-slate-700">
          {title} <span className="text-xs font-normal text-slate-400">({questions.length})</span>
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {questions.map((q) => {
          const userAnswer = result.answers[q.id];
          const correct = ANSWER_KEY[q.id];
          const ok = userAnswer === correct;
          const userOpt = q.opts.find((opt) => opt.k === userAnswer);
          const correctOpt = q.opts.find((opt) => opt.k === correct);

          return (
            <div key={q.id} className="px-5 py-4">
              <p className="mb-2 text-sm leading-relaxed text-slate-700">
                <span className="mr-1.5 text-xs font-bold text-slate-400">Q{q.canonicalNumber}</span>
                {q.text}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-medium ${!userAnswer ? 'bg-slate-100 text-slate-500' : ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {t.report.yourAnswer}: {userOpt ? `(${userOpt.k}) ${userOpt.t}` : t.report.notAnswered}
                </span>
                {!ok ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
                    {t.report.correct}: ({correctOpt?.k}) {correctOpt?.t}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ResultsScreen({ result, onHome }: { result: ReportResult; onHome: () => void }) {
  const { t, language } = useLocale();
  const [filter, setFilter] = useState<Filter>('all');
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const duration = `${Math.floor(result.durationSec / 60)}m ${result.durationSec % 60}s`;
  const dateLocale = language === 'zh-HK' ? 'zh-HK' : 'en-GB';

  const allQuestions = [...PART_A, ...PART_B];
  const filterQuestion = (qid: string) => {
    const userAnswer = result.answers[qid];
    const correct = ANSWER_KEY[qid];
    if (filter === 'incorrect') return Boolean(userAnswer) && userAnswer !== correct;
    if (filter === 'unanswered') return !userAnswer;
    return true;
  };
  const aQuestions = PART_A.filter((q) => filterQuestion(q.id));
  const bQuestions = PART_B.filter((q) => filterQuestion(q.id));

  const exportPdf = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      await document.fonts.ready;
      await downloadReportPdf(reportRef.current, `EDT-Report-${result.candidateInfo.id || 'candidate'}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <EdtNavBar variant="app" onLogoClick={onHome} onBack={onHome} />

      <div className="-mt-nav bg-edt-forest px-4 pb-8 pt-nav text-white no-print">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-edt-neon">
            {result.autoSubmitted ? t.report.autoSubmitted : t.report.submitted}
          </div>
          <h1 className="text-3xl font-extrabold">{t.report.title}</h1>
          <p className="mt-1 text-sm text-edt-soft/70">{t.report.subtitle}</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-8">
        <div ref={reportRef} id="report-export-root" className="space-y-8">
          <section className="rounded-2xl border border-slate-100 bg-white p-6 print-section">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">{t.report.candidateInfo}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                [t.report.name, result.candidateInfo.name],
                [t.report.candidateId, result.candidateInfo.id],
                [t.report.date, formatDate(result.candidateInfo.testDate, dateLocale)],
                [t.report.mode, result.candidateInfo.mode],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="mb-0.5 text-xs font-medium text-slate-400">{label}</p>
                  <p className="break-words text-sm font-semibold text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-3 gap-4 print-section">
            {[
              { label: t.report.partA, sub: t.report.appliedGrammar, correct: result.scores.partA.correct, total: 36, pct: result.scores.partA.pct },
              { label: t.report.partB, sub: t.report.vocabulary, correct: result.scores.partB.correct, total: 36, pct: result.scores.partB.pct },
              { label: t.report.final, sub: t.report.overallScore, correct: result.scores.total.correct, total: 72, pct: result.scores.total.pct, hi: true },
            ].map((score) => (
              <div key={score.label} className={`rounded-2xl border p-5 text-center ${score.hi ? 'border-edt-forest bg-edt-forest text-edt-neon' : 'border-slate-100 bg-white'}`}>
                <p className={`mb-1 text-xs font-bold uppercase tracking-widest ${score.hi ? 'text-edt-neon' : 'text-slate-400'}`}>{score.label}</p>
                <p className={`mb-0.5 text-3xl font-extrabold leading-none ${score.hi ? 'text-white' : 'text-slate-800'}`}>
                  {score.correct}<span className="ml-0.5 text-base font-medium text-slate-400">/{score.total}</span>
                </p>
                <p className="text-sm font-semibold">{score.pct}%</p>
                <p className={`mt-1 text-xs ${score.hi ? 'text-edt-soft/70' : 'text-slate-400'}`}>{score.sub}</p>
              </div>
            ))}
          </section>

          <section className={`rounded-2xl border-2 p-6 print-section ${result.cefrBand.colorCls}`}>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest opacity-70">{t.report.cefrLevel}</p>
            <div className="mb-2 flex items-baseline gap-3">
              <span className="text-4xl font-extrabold">{result.cefrBand.cefr}</span>
              <span className="text-base font-semibold opacity-80">{result.cefrBand.label}</span>
            </div>
            <p className="mb-2 text-sm font-semibold opacity-90">{result.cefrBand.headline}</p>
            <p className="text-sm leading-relaxed opacity-80">{result.cefrBand.description}</p>
          </section>

          {result.backendData ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-6 print-section">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">{t.report.cohortRanking}</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-sky-50 p-4 text-center">
                  <p className="text-xs font-semibold text-slate-500">Percentile</p>
                  <p className="text-3xl font-extrabold text-sky-600">{result.backendData.percentileRank ?? '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold text-slate-500">{t.report.cohortAverage}</p>
                  <p className="text-3xl font-extrabold text-slate-700">{result.backendData.cohortMean ?? '-'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold text-slate-500">Cohort size</p>
                  <p className="text-3xl font-extrabold text-slate-700">{result.backendData.cohortSize}</p>
                </div>
              </div>
            </section>
          ) : result.backendError ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 no-print">
              {t.report.backendError}
            </section>
          ) : null}

          <section className="overflow-visible rounded-2xl border border-slate-100 bg-white print-section">
            <div className="overflow-visible p-6 pb-2">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">{t.report.dimensionsTitle}</p>
              <div className="report-radar-export mx-auto w-1/2 max-w-[50%] overflow-visible">
                <RadarChart dimensions={result.dimensions} />
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {result.dimensions.map((dimension) => (
                <div key={dimension.id} className="px-5 py-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
                      {dimension.id}. {dimension.name}
                    </p>
                    <div className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${levelBadgeClass(dimension.level)}`}>
                      {dimension.score}/5 - {t.report.levelLabels[dimension.levelKey]}
                    </div>
                  </div>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${scoreBarColor(dimension.score, 5)}`} style={{ width: `${(dimension.score / 5) * 100}%` }} />
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{t.report.dimensionNarratives[dimension.levelKey]}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-xs leading-relaxed text-slate-500">{t.report.overallOnlyNote}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-6 print-section">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-700">{t.report.recommendations}</h3>
            <p className="text-sm leading-relaxed text-slate-600">{result.reportSnapshot.recommendation}</p>
            {result.reportSnapshot.weakDimensions.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.report.priorityDimensions}</p>
                <div className="flex flex-wrap gap-2">
                  {result.reportSnapshot.weakDimensions.map((dimension) => (
                    <span key={dimension} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                      {dimension}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
              <span>
                {t.report.duration}: {duration}
              </span>
              <span>Report v{result.reportVersion}</span>
            </div>
          </section>
        </div>

        <section className="mt-8 no-print">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">{t.report.questionReview}</h3>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs">
              {[
                ['all', t.report.all],
                ['incorrect', t.report.incorrect],
                ['unanswered', t.report.unanswered],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value as Filter)}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition-all ${filter === value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {aQuestions.length > 0 ? <ReviewSection title={t.report.appliedGrammar} questions={aQuestions} result={result} /> : null}
          {bQuestions.length > 0 ? (
            <div className="mt-4">
              <ReviewSection title={t.report.vocabulary} questions={bQuestions} result={result} />
            </div>
          ) : null}
          {allQuestions.filter((q) => filterQuestion(q.id)).length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-400">{t.report.noQuestions}</div>
          ) : null}
        </section>

        <div className="pb-4 pt-8 text-center no-print">
          <button
            onClick={() => void exportPdf()}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-xl bg-edt-forest px-6 py-3 text-sm font-semibold text-edt-neon transition-colors hover:bg-[#243b37] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? '...' : t.report.downloadPdf}
          </button>
        </div>
      </main>
    </div>
  );
}
