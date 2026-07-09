import { useState } from 'react';
import { AiFeedbackSection } from '../components/AiFeedbackSection';
import { EdtNavBar } from '../components/EdtNavBar';
import { RadarChart } from '../components/RadarChart';
import { useLocale } from '../i18n/LocaleContext';
import { downloadServerReportPdf } from '../lib/api';
import { formatDate } from '../lib/format';
import { scoreBarColor } from '../lib/scoring';
import type { AttemptReviewRow, Session, Test2Result } from '../types';

type Filter = 'all' | 'incorrect' | 'unanswered';

const PART_A = '01';
const PART_B = '02';

/** EDT-palette band card colors, keyed by conversion band_key. */
const BAND_COLOR: Record<string, string> = {
  b1Plus: 'bg-orange-100 text-orange-800 border-orange-300',
  lowB2: 'bg-amber-100 text-amber-800 border-amber-300',
  highB2LowC1: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  c1: 'bg-sky-100 text-sky-800 border-sky-300',
  c1PlusNearC2: 'bg-teal-100 text-teal-800 border-teal-300',
  c1PlusC2: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  c2: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

function formatCohortRankDisplay(
  rank: number | null | undefined,
  size: number,
  pendingLabel: string,
  ofLabel: string,
): string {
  if (size < 2) return pendingLabel;
  if (rank == null) return '—';
  return `${rank} ${ofLabel} ${size}`;
}

function ReviewSection({ title, rows }: { title: string; rows: AttemptReviewRow[] }) {
  const { t } = useLocale();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <span className="text-sm font-bold text-slate-700">
          {title} <span className="text-xs font-normal text-slate-400">({rows.length})</span>
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {rows.map((row) => {
          const ok = row.isCorrect === 1;
          const userText = row.selectedOption
            ? `(${row.selectedOption}) ${row.options[row.selectedOption as keyof typeof row.options] ?? ''}`
            : null;
          const correctText = `(${row.correctAnswer}) ${row.options[row.correctAnswer as keyof typeof row.options] ?? ''}`;

          return (
            <div key={row.questionCode} className="px-5 py-4">
              <p className="mb-2 text-sm leading-relaxed text-slate-700">
                <span className="mr-1.5 text-xs font-bold text-slate-400">Q{row.displayOrder ?? row.canonicalNumber}</span>
                {row.prompt}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className={`rounded-full px-2.5 py-1 font-medium ${
                    !row.selectedOption
                      ? 'bg-slate-100 text-slate-500'
                      : ok
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {t.report.yourAnswer}: {userText ?? t.report.notAnswered}
                </span>
                {!ok ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
                    {t.report.correct}: {correctText}
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

export function Test2ResultsScreen({
  result,
  session,
  onHome,
}: {
  result: Test2Result;
  session: Session;
  onHome: () => void;
}) {
  const { t, language } = useLocale();
  const [filter, setFilter] = useState<Filter>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const variables = result.variables;
  const dateLocale = language === 'zh-HK' ? 'zh-HK' : 'en-GB';

  if (!variables) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">
          {t.test2.startError}
        </div>
      </div>
    );
  }

  const duration = `${Math.floor(variables.attempt.durationSec / 60)}m ${variables.attempt.durationSec % 60}s`;
  const partScore = (partCode: string) => variables.scores.parts.find((part) => part.partCode === partCode);
  const partBand = (partCode: string) => variables.bands.parts.find((band) => band.partCode === partCode);
  const partA = partScore(PART_A);
  const partB = partScore(PART_B);
  const overall = variables.scores.overall;
  const pct = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 100) : 0);
  const overallBand = variables.bands.overall;
  const overallNarrative = overallBand ? t.test2.bandNarratives[overallBand.bandKey as keyof typeof t.test2.bandNarratives] : undefined;
  const overallColor = overallBand ? (BAND_COLOR[overallBand.bandKey] ?? 'bg-slate-100 text-slate-700 border-slate-300') : '';
  const cohort = variables.cohort;

  const filterRow = (row: AttemptReviewRow) => {
    if (filter === 'incorrect') return Boolean(row.selectedOption) && row.isCorrect !== 1;
    if (filter === 'unanswered') return !row.selectedOption;
    return true;
  };
  const listeningRows = result.review.filter((row) => row.partCode === PART_A && filterRow(row));
  const readingRows = result.review.filter((row) => row.partCode === PART_B && filterRow(row));

  const exportPdf = async () => {
    setIsExporting(true);
    setPdfError(false);
    try {
      const voucher = session.voucherCode ?? 'unknown';
      await downloadServerReportPdf(
        result.attemptId,
        language,
        session.sessionToken,
        `EDT-Report_${voucher}_02_${result.attemptId}.pdf`,
      );
    } catch {
      setPdfError(true);
    } finally {
      setIsExporting(false);
    }
  };

  const scoreCards = [
    {
      label: t.report.partA,
      sub: t.test2.partAListening,
      correct: partA?.correct ?? 0,
      total: partA?.total ?? 0,
      band: partBand(PART_A)?.cefrLabel,
    },
    {
      label: t.report.partB,
      sub: t.test2.partBReading,
      correct: partB?.correct ?? 0,
      total: partB?.total ?? 0,
      band: partBand(PART_B)?.cefrLabel,
    },
    {
      label: t.report.final,
      sub: t.report.overallScore,
      correct: overall.correct,
      total: overall.total,
      band: overallBand?.cefrLabel,
      hi: true,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <EdtNavBar variant="app" onLogoClick={onHome} onBack={onHome} />

      <div className="-mt-nav bg-edt-forest px-4 pb-8 pt-nav text-white no-print">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-edt-neon">
            {variables.attempt.autoSubmitted ? t.report.autoSubmitted : t.report.submitted}
          </div>
          <h1 className="text-3xl font-extrabold">{t.report.title}</h1>
          <p className="mt-1 text-sm text-edt-soft/70">{t.test2.reportSubtitle}</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-8">
        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-100 bg-white p-6">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">{t.report.candidateInfo}</h2>
            <div className="mb-4 inline-flex items-center rounded-full border border-edt-forest/20 bg-edt-forest/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-edt-forest">
              {t.report.userGroup}: {variables.candidate.userGroup}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                [t.report.name, variables.candidate.name],
                [t.report.candidateId, variables.candidate.ref],
                [t.report.date, formatDate(variables.attempt.endTime, dateLocale)],
                [t.report.duration, duration],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="mb-0.5 text-xs font-medium text-slate-400">{label}</p>
                  <p className="break-words text-sm font-semibold text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {scoreCards.map((score) => (
              <div
                key={score.label}
                className={`rounded-2xl border p-5 text-center ${score.hi ? 'border-edt-forest bg-edt-forest text-edt-neon' : 'border-slate-100 bg-white'}`}
              >
                <p className={`mb-1 text-xs font-bold uppercase tracking-widest ${score.hi ? 'text-edt-neon' : 'text-slate-400'}`}>
                  {score.label}
                </p>
                <p className={`mb-0.5 text-3xl font-extrabold leading-none ${score.hi ? 'text-white' : 'text-slate-800'}`}>
                  {score.correct}
                  <span className="ml-0.5 text-base font-medium text-slate-400">/{score.total}</span>
                </p>
                <p className="text-sm font-semibold">{pct(score.correct, score.total)}%</p>
                <p className={`mt-1 text-xs ${score.hi ? 'text-edt-soft/70' : 'text-slate-400'}`}>
                  {score.sub}
                  {score.band ? ` · ${score.band}` : ''}
                </p>
              </div>
            ))}
          </section>

          {overallBand ? (
            <section className={`rounded-2xl border-2 p-6 ${overallColor}`}>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest opacity-70">{t.test2.overallBand}</p>
              <div className="mb-2 flex items-baseline gap-3">
                <span className="text-4xl font-extrabold">{overallBand.cefrLabel}</span>
              </div>
              {overallNarrative ? (
                <>
                  <p className="mb-2 text-sm font-semibold opacity-90">{overallNarrative.headline}</p>
                  <p className="text-sm leading-relaxed opacity-80">{overallNarrative.recommendation}</p>
                </>
              ) : null}
              <div className="mt-4 grid gap-3 border-t border-current/10 pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{t.report.approxIelts}</p>
                  <p className="text-sm font-semibold opacity-90">{overallBand.ielts ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{t.report.approxToefl}</p>
                  <p className="text-sm font-semibold opacity-90">{overallBand.toefl ?? '—'}</p>
                </div>
              </div>
              <p className="mt-3 text-xs italic leading-relaxed opacity-70">{t.report.proficiencyDisclaimer}</p>
            </section>
          ) : null}

          {variables.bands.parts.length > 0 ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-6">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">{t.test2.partBands}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {variables.bands.parts.map((band) => {
                  const label = band.partCode === PART_A ? t.test2.partBandListening : t.test2.partBandReading;
                  const score = partScore(band.partCode);
                  const narrative = t.test2.bandNarratives[band.bandKey as keyof typeof t.test2.bandNarratives];
                  return (
                    <div
                      key={band.partCode}
                      className={`rounded-xl border-2 p-4 ${BAND_COLOR[band.bandKey] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}
                    >
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold">{band.cefrLabel}</span>
                        {score ? (
                          <span className="text-sm font-semibold opacity-80">
                            {score.correct}/{score.total}
                          </span>
                        ) : null}
                      </div>
                      {narrative ? <p className="mb-2 text-xs leading-relaxed opacity-80">{narrative.headline}</p> : null}
                      <div className="mt-2 space-y-0.5 border-t border-current/10 pt-2 text-xs opacity-80">
                        {band.ielts ? (
                          <p>
                            {t.report.approxIelts}: <span className="font-semibold">{band.ielts}</span>
                          </p>
                        ) : null}
                        {band.toefl ? (
                          <p>
                            {t.report.approxToefl}: <span className="font-semibold">{band.toefl}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {cohort ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-6">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">{t.report.cohortRanking}</h3>
              <div className="grid gap-6 lg:grid-cols-2">
                {[
                  {
                    title: t.report.studyGroup,
                    rank: cohort.groupCohortRank,
                    mean: cohort.groupCohortMean,
                    size: cohort.groupCohortSize,
                    accent: 'border-emerald-100 bg-emerald-50/40',
                    valueCls: 'text-emerald-700',
                  },
                  {
                    title: t.report.allLearners,
                    rank: cohort.cohortRank,
                    mean: cohort.cohortMean,
                    size: cohort.cohortSize,
                    accent: 'border-sky-100 bg-sky-50/40',
                    valueCls: 'text-sky-700',
                  },
                ].map((entry) => (
                  <div key={entry.title} className={`rounded-xl border p-4 ${entry.accent}`}>
                    <p className="mb-3 text-sm font-bold text-slate-700">{entry.title}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white/80 p-3 text-center">
                        <p className="text-xs font-semibold text-slate-500">{t.report.cohortRank}</p>
                        <p className={`text-lg font-extrabold leading-snug ${entry.size < 2 ? 'text-sm font-semibold text-slate-500' : entry.valueCls}`}>
                          {formatCohortRankDisplay(entry.rank, entry.size, t.report.cohortRankPending, t.report.cohortRankOf)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-3 text-center">
                        <p className="text-xs font-semibold text-slate-500">{t.report.cohortAverage}</p>
                        <p className="text-2xl font-extrabold text-slate-700">{entry.mean ?? '-'}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-3 text-center">
                        <p className="text-xs font-semibold text-slate-500">{t.report.cohortSize}</p>
                        <p className="text-2xl font-extrabold text-slate-700">{entry.size}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">{t.report.basedOn}</p>
            </section>
          ) : null}

          {variables.dimensions.length > 0 ? (
            <section className="overflow-visible rounded-2xl border border-slate-100 bg-white">
              <div className="overflow-visible p-6 pb-2">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {t.test2.dimensionsRadarTitle}
                </p>
                <div className="report-radar-export mx-auto w-1/2 max-w-[50%] overflow-visible">
                  <RadarChart
                    axes={[...variables.dimensions]
                      .sort((a, b) => (a.partCode + a.dimensionCode).localeCompare(b.partCode + b.dimensionCode))
                      .map((dimension) => ({
                        id: dimension.key,
                        short:
                          t.test2.dimensionShorts[dimension.key as keyof typeof t.test2.dimensionShorts] ??
                          dimension.key,
                        score: dimension.score,
                        max: dimension.max,
                      }))}
                  />
                </div>
              </div>
              <div className="border-b border-slate-100 p-6 pb-4 pt-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t.test2.difficultyTitle}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {variables.dimensions.map((dimension) => {
                  const label =
                    t.test2.dimensionLabels[dimension.key as keyof typeof t.test2.dimensionLabels] ?? dimension.key;
                  return (
                    <div key={dimension.key} className="px-5 py-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 text-sm font-semibold text-slate-700">{label}</p>
                        <div className="flex-shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                          {dimension.score}/{dimension.max} - {t.report.levelLabels[dimension.levelKey]}
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${scoreBarColor(dimension.score, dimension.max)}`}
                          style={{ width: `${dimension.max > 0 ? (dimension.score / dimension.max) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                <p className="text-xs leading-relaxed text-slate-500">{t.test2.difficultyNote}</p>
              </div>
            </section>
          ) : null}
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
          {listeningRows.length > 0 ? (
            <ReviewSection title={`${t.report.partA} — ${t.test2.partAListening}`} rows={listeningRows} />
          ) : null}
          {readingRows.length > 0 ? (
            <div className="mt-4">
              <ReviewSection title={`${t.report.partB} — ${t.test2.partBReading}`} rows={readingRows} />
            </div>
          ) : null}
          {listeningRows.length === 0 && readingRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-400">
              {t.report.noQuestions}
            </div>
          ) : null}
        </section>

        <div className="pb-4 pt-8 no-print">
          {pdfError ? <p className="mb-3 text-center text-sm text-rose-600">{t.test2.pdfError}</p> : null}
          <AiFeedbackSection
            attemptId={result.attemptId}
            sessionToken={session.sessionToken}
            downloadButton={
              <button
                onClick={() => void exportPdf()}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-xl bg-edt-forest px-6 py-3 text-sm font-semibold text-edt-neon transition-colors hover:bg-[#243b37] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isExporting ? t.report.downloading : t.report.downloadPdf}
              </button>
            }
          />
        </div>
      </main>
    </div>
  );
}
