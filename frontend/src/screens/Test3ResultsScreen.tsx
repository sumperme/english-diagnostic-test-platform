import { useEffect, useState } from 'react';
import { AiFeedbackSection } from '../components/AiFeedbackSection';
import { EdtNavBar } from '../components/EdtNavBar';
import { useLocale } from '../i18n/LocaleContext';
import { downloadServerReportPdf, fetchAudioBlob } from '../lib/api';
import { formatDate } from '../lib/format';
import { stripSpeakingUiBoilerplate } from '../lib/paper3Prompt';
import type { AttemptReviewRow, Session, Test2Result } from '../types';

const BAND_COLOR: Record<string, string> = {
  b1b2: 'bg-amber-100 text-amber-800 border-amber-300',
  c1: 'bg-sky-100 text-sky-800 border-sky-300',
  c2: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const PART_A = '01';
const PART_B = '02';

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

function humanizeDimensionKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function isUnansweredRow(row: AttemptReviewRow): boolean {
  if (row.aiMark && typeof row.aiMark === 'object' && (row.aiMark as { unanswered?: boolean }).unanswered) {
    return true;
  }
  return !row.aiBandKey;
}

function AuthenticatedAudio({ url, sessionToken }: { url: string; sessionToken: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void fetchAudioBlob(url, sessionToken)
      .then((objectUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        revoked = objectUrl;
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [url, sessionToken]);

  if (error) return <p className="mt-2 text-xs text-rose-600">Audio unavailable</p>;
  if (!src) return <p className="mt-2 text-xs text-slate-400">Loading audio…</p>;
  return <audio className="mt-2 w-full" controls src={src} />;
}

export function Test3ResultsScreen({
  result,
  session,
  onHome,
}: {
  result: Test2Result;
  session: Session;
  onHome: () => void;
}) {
  const { t, language } = useLocale();
  const [isExporting, setIsExporting] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const variables = result.variables;
  const dateLocale = language === 'zh-HK' ? 'zh-HK' : 'en-GB';

  if (!variables) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">
          {t.test2.processingSubmit}
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
  const paper3 = t.test2.paper3Report;
  const overallNarrative = overallBand
    ? paper3.bandNarratives[overallBand.bandKey as keyof typeof paper3.bandNarratives]
    : undefined;
  const overallColor = overallBand
    ? (BAND_COLOR[overallBand.bandKey] ?? 'bg-slate-100 text-slate-700 border-slate-300')
    : '';
  const cohort = variables.cohort;

  const speakingRows = result.review.filter((row) => row.partCode === PART_A);
  const writingRows = result.review.filter((row) => row.partCode === PART_B);

  const taskTitle = (row: AttemptReviewRow) => {
    const key = row.dimensionKey ?? '';
    const friendly =
      paper3.taskTitles[key as keyof typeof paper3.taskTitles] ??
      (key ? humanizeDimensionKey(key) : `Task ${row.canonicalNumber}`);
    return `Question ${row.canonicalNumber}: ${friendly}`;
  };

  const exportPdf = async () => {
    setIsExporting(true);
    setPdfError(false);
    try {
      const voucher = session.voucherCode ?? 'unknown';
      await downloadServerReportPdf(
        result.attemptId,
        language,
        session.sessionToken,
        `EDT-Report_${voucher}_03_${result.attemptId}.pdf`,
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
      sub: t.test2.partASpeaking,
      correct: partA?.correct ?? 0,
      total: partA?.total ?? 8,
      band: partBand(PART_A)?.cefrLabel,
    },
    {
      label: t.report.partB,
      sub: t.test2.partBWriting,
      correct: partB?.correct ?? 0,
      total: partB?.total ?? 2,
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

  const TaskCard = ({ row }: { row: AttemptReviewRow }) => {
    const unanswered = isUnansweredRow(row);
    const band = row.aiBandKey ?? row.aiMark?.bandKey;
    const color = unanswered
      ? 'bg-slate-100 text-slate-600 border-slate-300'
      : BAND_COLOR[band ?? ''] ?? 'bg-slate-100 text-slate-700 border-slate-300';

    return (
      <article className="rounded-2xl border border-slate-100 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-edt-forest">{taskTitle(row)}</h3>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>
            {unanswered ? t.report.notAnswered : (row.aiMark?.cefrLabel ?? band?.toUpperCase() ?? '—')}
          </span>
        </div>
        <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-slate-500">
          {row.responseType === 'speaking' ? stripSpeakingUiBoilerplate(row.prompt) : row.prompt}
        </p>
        {!unanswered && row.responseType === 'speaking' && row.audioUrl ? (
          <AuthenticatedAudio url={row.audioUrl} sessionToken={session.sessionToken} />
        ) : null}
        {!unanswered && row.responseType === 'writing' && row.textResponse ? (
          <div className="mb-3 max-h-40 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
            {row.textResponse}
          </div>
        ) : null}
        {!unanswered && row.aiMark?.strengths?.length ? (
          <p className="mt-2 text-xs text-emerald-700">
            <span className="font-semibold">{paper3.strengths}: </span>
            {row.aiMark.strengths.join('; ')}
          </p>
        ) : null}
        {!unanswered && row.aiMark?.improvements?.length ? (
          <p className="mt-1 text-xs text-amber-800">
            <span className="font-semibold">{paper3.improvements}: </span>
            {row.aiMark.improvements.join('; ')}
          </p>
        ) : null}
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <EdtNavBar variant="app" onLogoClick={onHome} onBack={onHome} />

      <div className="-mt-nav bg-edt-forest px-4 pb-8 pt-nav text-white no-print">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-edt-neon">
            {variables.attempt.autoSubmitted ? t.report.autoSubmitted : t.report.submitted}
          </div>
          <h1 className="text-3xl font-extrabold">{t.report.title}</h1>
          <p className="mt-1 text-sm text-edt-soft/70">{paper3.reportSubtitle}</p>
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
                  const label =
                    band.partCode === PART_A ? paper3.partBandSpeaking : paper3.partBandWriting;
                  const score = partScore(band.partCode);
                  const narrative = paper3.bandNarratives[band.bandKey as keyof typeof paper3.bandNarratives];
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
                        <p
                          className={`text-lg font-extrabold leading-snug ${entry.size < 2 ? 'text-sm font-semibold text-slate-500' : entry.valueCls}`}
                        >
                          {formatCohortRankDisplay(
                            entry.rank,
                            entry.size,
                            t.report.cohortRankPending,
                            t.report.cohortRankOf,
                          )}
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

          <section className="no-print">
            <h3 className="mb-4 text-lg font-bold text-slate-800">
              {t.report.partA} — {t.test2.partASpeaking}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {speakingRows.map((row) => (
                <TaskCard key={row.questionCode} row={row} />
              ))}
            </div>
          </section>

          <section className="no-print">
            <h3 className="mb-4 text-lg font-bold text-slate-800">
              {t.report.partB} — {t.test2.partBWriting}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {writingRows.map((row) => (
                <TaskCard key={row.questionCode} row={row} />
              ))}
            </div>
          </section>
        </div>

        <div className="pb-4 pt-8 no-print">
          {pdfError ? <p className="mb-3 text-center text-sm text-rose-600">{t.test2.pdfError}</p> : null}
          <AiFeedbackSection
            attemptId={result.attemptId}
            sessionToken={session.sessionToken}
            downloadButton={
              <button
                type="button"
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
