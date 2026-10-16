import { useCallback, useEffect, useState } from 'react';
import { FeedbackBody } from '../components/AiFeedbackSection';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { useLocale } from '../i18n/LocaleContext';
import { getMessages } from '../i18n/messages';
import {
  ApiError,
  clearTeacherSession,
  downloadServerReportPdf,
  fetchClassOverviews,
  fetchTeacherDashboard,
  generateClassOverview,
} from '../lib/api';
import { explainedQuestionId } from '../lib/explainedQuestionId';
import type { Language, AiQuota, ClassOverview, TeacherDashboardData, TeacherSession } from '../types';

type SortDir = 'asc' | 'desc';

function fmt(n: number | null, empty: string, decimals = 1): string {
  if (n == null) return empty;
  return n.toFixed(decimals);
}

function dateLocale(language: Language): string {
  return language === 'zh-HK' ? 'zh-HK' : 'en-GB';
}

function fmtDate(ms: number, language: Language): string {
  return new Date(ms).toLocaleDateString(dateLocale(language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtDatetime(ms: number, language: Language): string {
  return new Date(ms).toLocaleString(dateLocale(language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-edt-forest">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

function ScoreBar({ value, max = 100, colorClass = 'bg-edt-neon' }: { value: number; max?: number; colorClass?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function correctRateColor(rate: number | null): string {
  if (rate == null) return 'bg-slate-200';
  if (rate >= 70) return 'bg-emerald-500';
  if (rate >= 40) return 'bg-amber-400';
  return 'bg-rose-400';
}

function aiSnippet(text: string, maxWords = 12): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  return words.length <= maxWords ? words.join(' ') : `${words.slice(0, maxWords).join(' ')}…`;
}

function paperName(
  testCode: '01' | '02' | '03',
  labels: { paperI: string; paperII: string; paperIII: string },
): string {
  if (testCode === '01') return labels.paperI;
  if (testCode === '02') return labels.paperII;
  return labels.paperIII;
}

/** Class AI Overview card: history pager + quota-limited generate button (per paper). */
function ClassOverviewSection({
  teacherKey,
  testCode,
  hasAttempts,
}: {
  teacherKey: string;
  testCode: '01' | '02' | '03';
  hasAttempts: boolean;
}) {
  const { t, language } = useLocale();
  const [overviews, setOverviews] = useState<ClassOverview[]>([]);
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [index, setIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setOverviews([]);
    setIndex(0);
    setError('');
    fetchClassOverviews(teacherKey, testCode)
      .then((list) => {
        if (cancelled) return;
        setOverviews(list.overviews);
        setQuota(list.quota);
      })
      .catch(() => {
        // Quota/history unavailable — button falls back to a plain label.
      });
    return () => {
      cancelled = true;
    };
  }, [teacherKey, testCode]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setError('');
    try {
      const result = await generateClassOverview(teacherKey, testCode);
      setOverviews((previous) => [{ id: Date.now(), ...result.overview }, ...previous]);
      setQuota(result.quota);
      setIndex(0);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      if (code === 'NO_QUOTA') {
        setError(t.teacher.noOverviewQuota);
      } else if (code === 'NO_SUBMISSIONS') {
        setError(t.teacher.noOverviewSubmissions);
      } else {
        setError(t.teacher.overviewUnavailable);
      }
    } finally {
      setGenerating(false);
    }
  };

  const remaining = quota ? quota.remaining : null;
  const current = overviews[index];
  const disabled = generating || !hasAttempts || (remaining != null && remaining <= 0);
  const paperLabel = paperName(testCode, t.teacher);
  const overviewContent =
    language === 'zh-HK' && current?.contentZh.trim()
      ? current.contentZh
      : current?.contentEn ?? '';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-center text-sm font-bold uppercase tracking-widest text-slate-500">
        {t.teacher.classOverviewTitle} · {paperLabel}
      </h2>

      {current ? (
        <div className="mx-auto mb-5 max-w-5xl rounded-2xl border border-edt-indigo/25 bg-slate-50/60 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(overviews.length - 1, i + 1))}
              disabled={index >= overviews.length - 1}
              aria-label={t.teacher.olderOverview}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
            <p className="text-xs text-slate-400">
              {fmtDatetime(current.createdAt, language)} · {index + 1} / {overviews.length}
            </p>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index <= 0}
              aria-label={t.teacher.newerOverview}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          </div>
          <FeedbackBody content={overviewContent} />
        </div>
      ) : null}

      {generating ? (
        <div className="mx-auto mb-5 flex max-w-5xl items-center justify-center gap-2 rounded-2xl border border-edt-indigo/25 bg-white p-6">
          <span className="h-2 w-2 animate-bounce rounded-full bg-edt-indigo" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-edt-gold [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-edt-indigo [animation-delay:300ms]" />
          <span className="ml-2 text-sm font-semibold text-edt-indigo">{t.teacher.generatingOverview}</span>
        </div>
      ) : null}

      {error ? <p className="mx-auto mb-4 max-w-5xl text-center text-sm text-amber-700">{error}</p> : null}

      <div className="text-center">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={disabled}
          title={remaining != null && remaining <= 0 ? t.teacher.noOverviewQuotaTitle : undefined}
          className="inline-flex items-center gap-2 rounded-xl bg-edt-indigo px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#4f4e7d] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating
            ? t.teacher.generating
            : remaining != null
              ? t.teacher.generateOverviewRemaining.replace('{n}', String(remaining))
              : t.teacher.generateOverview}
        </button>
      </div>
    </section>
  );
}

export function TeacherDashboardScreen({
  session,
  onSignOut,
}: {
  session: TeacherSession;
  onSignOut: () => void;
}) {
  const { t, language } = useLocale();
  const reportDimensionLabels = getMessages('en').report.dimensionLabels;
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [paperFilter, setPaperFilter] = useState<'01' | '02' | '03'>('01');

  // Submission table sort
  const [subSortDir, setSubSortDir] = useState<SortDir>('desc');

  // Question table sort
  const [qSortDir, setQSortDir] = useState<SortDir | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchTeacherDashboard(session.teacherKey);
      setData(result);
    } catch {
      setError(t.teacher.loadError);
    } finally {
      setLoading(false);
    }
  }, [session.teacherKey, t.teacher.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSignOut = () => {
    clearTeacherSession();
    onSignOut();
  };

  const sortedSubmissions = data
    ? [...data.submissions].sort((a, b) =>
        subSortDir === 'desc' ? b.submittedAt - a.submittedAt : a.submittedAt - b.submittedAt,
      )
    : [];

  const sortedQuestions = data
    ? (() => {
        const qs = [...data.questionStats];
        if (qSortDir === 'asc') {
          qs.sort((a, b) => (a.correctRate ?? -1) - (b.correctRate ?? -1));
        } else if (qSortDir === 'desc') {
          qs.sort((a, b) => (b.correctRate ?? -1) - (a.correctRate ?? -1));
        }
        return qs;
      })()
    : [];

  const toggleSubSort = () => setSubSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
  const toggleQSort = (dir: SortDir) => setQSortDir((d) => (d === dir ? null : dir));
  const empty = t.teacher.na;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="border-b border-edt-olive/20 bg-edt-forest px-4 py-4 text-edt-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-edt-neon">{t.teacher.dashboardTitle}</h1>
            <p className="text-sm text-edt-soft/70">
              {t.teacher.classLabel} <span className="font-semibold text-edt-gold">{session.userGroup}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border border-edt-olive px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-edt-olive transition-colors hover:text-edt-soft disabled:opacity-50"
            >
              {t.teacher.refresh}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-edt-olive px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-edt-olive transition-colors hover:text-edt-soft"
            >
              {t.teacher.signOut}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}

        {loading && !data ? (
          <div className="py-20 text-center text-sm text-slate-400">{t.teacher.loading}</div>
        ) : null}

        {data ? (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label={t.teacher.summaryTotalVouchers} value={data.totalVouchers} />
              <StatCard label={t.teacher.summaryUsedVouchers} value={data.usedVouchers} />
              <StatCard label={t.teacher.summarySubmissions} value={data.totalSubmissions} />
              <StatCard label={t.teacher.summaryMean} value={fmt(data.overallMean, empty)} sub={t.teacher.outOf60} />
              <StatCard label={t.teacher.summaryPartBMean} value={fmt(data.partBMean ?? null, empty)} sub={t.teacher.outOf30} />
            </div>

            {/* Overall Score Stats + Bar Chart */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">
                {t.teacher.scoreDistributionTitle}
              </h2>
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-400">{t.teacher.scoreMean}</p>
                  <p className="mt-1 text-2xl font-extrabold text-edt-forest">{fmt(data.overallMean, empty)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-400">{t.teacher.scoreMedian}</p>
                  <p className="mt-1 text-2xl font-extrabold text-edt-forest">{fmt(data.overallMedian, empty)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-400">{t.teacher.scoreStdDev}</p>
                  <p className="mt-1 text-2xl font-extrabold text-edt-forest">{fmt(data.overallStdDev, empty)}</p>
                </div>
              </div>
              {/* Bar chart */}
              <div className="space-y-3">
                {data.scoreBuckets.map((bucket) => {
                  const maxCount = Math.max(1, ...data.scoreBuckets.map((b) => b.count));
                  const pct = (bucket.count / maxCount) * 100;
                  return (
                    <div key={bucket.label} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-right text-xs text-slate-500">{bucket.label}</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-6 rounded-full bg-edt-indigo transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-xs font-semibold text-slate-600">{bucket.count}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 12 Dimension Stats */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">
                {t.teacher.dimensionTitle}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.dimensionStats.map((dim) => (
                  <div key={dim.key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">
                      {t.report.dimensionLabels[dim.key as keyof typeof t.report.dimensionLabels] ?? dim.name}
                    </p>
                    <p className="mt-2 text-xl font-bold text-edt-forest">
                      {fmt(dim.mean, empty)} <span className="text-sm font-normal text-slate-400">{t.teacher.dimensionMax}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {t.teacher.dimensionStdDev.replace('{value}', fmt(dim.stdDev, empty))}
                    </p>
                    <div className="mt-3">
                      <ScoreBar
                        value={dim.mean ?? 0}
                        max={5}
                        colorClass={
                          (dim.mean ?? 0) >= 4
                            ? 'bg-emerald-500'
                            : (dim.mean ?? 0) >= 3
                              ? 'bg-sky-500'
                              : (dim.mean ?? 0) >= 2
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Paper filter */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['01', t.teacher.paperI],
                    ['02', t.teacher.paperII],
                    ['03', t.teacher.paperIII],
                  ] as const
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setPaperFilter(code)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] ${
                      paperFilter === code
                        ? 'bg-edt-forest text-edt-neon'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {paperFilter === '01' ? (
            /* Student Submission Table (Paper I) */
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                  {t.teacher.paperISubmissions.replace('{count}', String(data.totalSubmissions))}
                </h2>
                <button
                  type="button"
                  onClick={toggleSubSort}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  {t.teacher.sortSubmitted} {subSortDir === 'desc' ? t.teacher.sortNewest : t.teacher.sortOldest}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2 whitespace-nowrap">{t.teacher.colSubmittedAt}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t.teacher.colCandidateName}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t.teacher.colCandidateId}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t.teacher.colTestDate}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t.teacher.colPartA}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t.teacher.colPartB}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t.teacher.colOverall}</th>
                      <th className="px-3 py-2 whitespace-nowrap">{t.teacher.colCefr}</th>
                      <th className="px-3 py-2">{t.teacher.colWeakAreas}</th>
                      <th className="px-3 py-2">{t.teacher.colAiFeedback}</th>
                      <th className="px-3 py-2">{t.teacher.colActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-8 text-center text-xs text-slate-400">
                          {t.teacher.noSubmissions}
                        </td>
                      </tr>
                    ) : null}
                    {sortedSubmissions.map((sub) => (
                      <tr key={sub.submissionId} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">
                          {fmtDatetime(sub.submittedAt, language)}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium">{sub.candidateName}</td>
                        <td className="px-3 py-3 font-mono text-xs">{sub.candidateId}</td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">{fmtDate(sub.testDate, language)}</td>
                        <td className="px-3 py-3 text-xs font-semibold">
                          {sub.partAScore ?? '—'}
                          <span className="font-normal text-slate-400">{t.teacher.scoreOutOf60}</span>
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold">
                          {sub.partBScore ?? '—'}
                          <span className="font-normal text-slate-400">{t.teacher.scoreOutOf30}</span>
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold">
                          {sub.overallPercent != null ? `${sub.overallPercent.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-edt-indigo/10 px-2 py-0.5 text-xs font-semibold text-edt-indigo">
                            {sub.cefr}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-rose-600">
                          {sub.weakDimensions.length > 0
                            ? sub.weakDimensions
                                .map((key) => reportDimensionLabels[key as keyof typeof reportDimensionLabels] ?? key)
                                .join(', ')
                            : <span className="text-emerald-600">{t.teacher.none}</span>}
                        </td>
                        <td className="px-3 py-3 max-w-[220px] text-xs">
                          {sub.aiFeedback ? (
                            <span className="cursor-help text-edt-indigo" title={sub.aiFeedback}>
                              {aiSnippet(sub.aiFeedback)}
                            </span>
                          ) : (
                            <span className="text-slate-400">{t.teacher.na}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {sub.attemptId ? (
                            <button
                              type="button"
                              className="rounded-lg border border-edt-neon px-2 py-1 text-[10px] font-bold uppercase text-edt-forest"
                              onClick={() =>
                                void downloadServerReportPdf(
                                  sub.attemptId!,
                                  '',
                                  `EDT-Report_01_${sub.attemptId}.pdf`,
                                  session.teacherKey,
                                )
                              }
                            >
                              {t.teacher.downloadPdf}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">
                {(paperFilter === '02' ? t.teacher.paperIIAttempts : t.teacher.paperIIIAttempts).replace(
                  '{count}',
                  String((data.paperAttempts ?? []).filter((a) => a.testCode === paperFilter).length),
                )}
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2">{t.teacher.colSubmitted}</th>
                      <th className="px-3 py-2">{t.teacher.colCandidate}</th>
                      <th className="px-3 py-2">{t.teacher.colRef}</th>
                      <th className="px-3 py-2">{t.teacher.colOverallBand}</th>
                      <th className="px-3 py-2">{t.teacher.colParts}</th>
                      <th className="px-3 py-2">{t.teacher.colStatus}</th>
                      <th className="px-3 py-2">{t.teacher.colActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.paperAttempts ?? [])
                      .filter((a) => a.testCode === paperFilter)
                      .map((row) => (
                        <tr key={row.attemptId} className="border-b border-slate-100 align-top">
                          <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">
                            {row.submittedAt ? fmtDatetime(row.submittedAt, language) : '—'}
                          </td>
                          <td className="px-3 py-3 text-xs font-medium">{row.candidateName}</td>
                          <td className="px-3 py-3 font-mono text-xs">{row.candidateRef}</td>
                          <td className="px-3 py-3 text-xs font-semibold">{row.overallBand ?? '—'}</td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {row.partBands.map((b) => `${b.partCode}:${b.cefrLabel}`).join(' · ') || '—'}
                          </td>
                          <td className="px-3 py-3 text-xs">{row.gradingStatus}</td>
                          <td className="px-3 py-3 text-xs">
                            <button
                              type="button"
                              className="rounded-lg border border-edt-neon px-2 py-1 text-[10px] font-bold uppercase text-edt-forest"
                              onClick={() =>
                                void downloadServerReportPdf(
                                  row.attemptId,
                                  '',
                                  `EDT-Report_${row.testCode}_${row.attemptId}.pdf`,
                                  session.teacherKey,
                                )
                              }
                            >
                              {t.teacher.downloadPdf}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
            )}

            {paperFilter === '01' ? (
            /* Question Correctness Rate Table */
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                  {t.teacher.questionTableTitle}
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleQSort('asc')}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      qSortDir === 'asc'
                        ? 'border-edt-neon bg-edt-neon text-edt-forest'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {t.teacher.sortLowest}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleQSort('desc')}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      qSortDir === 'desc'
                        ? 'border-edt-neon bg-edt-neon text-edt-forest'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {t.teacher.sortHighest}
                  </button>
                  {qSortDir ? (
                    <button
                      type="button"
                      onClick={() => setQSortDir(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-50"
                    >
                      {t.teacher.sortReset}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2">{t.teacher.colQuestionNum}</th>
                      <th className="min-w-[280px] px-3 py-2">{t.teacher.colQuestionId}</th>
                      <th className="px-3 py-2">{t.teacher.colPart}</th>
                      <th className="px-3 py-2">{t.teacher.colResponses}</th>
                      <th className="px-3 py-2 w-48">{t.teacher.colCorrectRate}</th>
                      <th className="px-3 py-2 w-32" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQuestions.map((q, idx) => (
                      <tr key={q.qid} className="border-b border-slate-100 align-middle hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                        <td className="max-w-xs px-3 py-2 font-mono text-[11px] font-semibold leading-relaxed break-all">
                          {explainedQuestionId(q.qid, q.canonicalNumber, q.part)}
                        </td>
                        <td className="px-3 py-2 text-xs">{t.teacher.partLabel.replace('{part}', q.part)}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{q.totalResponses}</td>
                        <td className="px-3 py-2">
                          {q.correctRate == null ? (
                            <span className="text-xs text-slate-300">{t.teacher.na}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <ScoreBar
                                  value={q.correctRate}
                                  max={100}
                                  colorClass={correctRateColor(q.correctRate)}
                                />
                              </div>
                              <span className="w-12 shrink-0 text-right text-xs font-semibold">
                                {q.correctRate.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {q.correctRate != null && q.correctRate < 40 ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                              {t.teacher.difficult}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            ) : null}

            {/* Class AI Overview (bottom-center) — scoped to active paper filter */}
            <ClassOverviewSection
              teacherKey={session.teacherKey}
              testCode={paperFilter}
              hasAttempts={
                paperFilter === '01'
                  ? data.totalSubmissions > 0
                  : (data.paperAttempts ?? []).some((a) => a.testCode === paperFilter)
              }
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
