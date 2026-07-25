import { useCallback, useEffect, useState } from 'react';
import { FeedbackBody } from '../components/AiFeedbackSection';
import {
  ApiError,
  clearTeacherSession,
  downloadServerReportPdf,
  fetchAttemptReportAsTeacher,
  fetchClassOverviews,
  fetchTeacherDashboard,
  generateClassOverview,
} from '../lib/api';
import { explainedQuestionId } from '../lib/explainedQuestionId';
import type {
  AiQuota,
  ClassOverview,
  TeacherDashboardData,
  TeacherQuestionStat,
  TeacherSession,
  TeacherSubmissionRow,
} from '../types';

type SortDir = 'asc' | 'desc';

function fmt(n: number | null, decimals = 1): string {
  if (n == null) return 'N/A';
  return n.toFixed(decimals);
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDatetime(ms: number): string {
  return new Date(ms).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
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
        setError('No AI overview uses left. Ask the administrator to increase your allowance.');
      } else if (code === 'NO_SUBMISSIONS') {
        setError('No results for this paper in this class yet — the overview needs at least one completed attempt.');
      } else {
        setError('The AI overview is temporarily unavailable. Your quota was not deducted — please try again in a moment.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const remaining = quota ? quota.remaining : null;
  const current = overviews[index];
  const disabled = generating || !hasAttempts || (remaining != null && remaining <= 0);
  const paperLabel = testCode === '01' ? 'Paper I' : testCode === '02' ? 'Paper II' : 'Paper III';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-center text-sm font-bold uppercase tracking-widest text-slate-500">
        Class AI Overview · {paperLabel}
      </h2>

      {current ? (
        <div className="mx-auto mb-5 max-w-5xl rounded-2xl border border-edt-indigo/25 bg-slate-50/60 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(overviews.length - 1, i + 1))}
              disabled={index >= overviews.length - 1}
              aria-label="Older overview"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ←
            </button>
            <p className="text-xs text-slate-400">
              {fmtDatetime(current.createdAt)} · {index + 1} / {overviews.length}
            </p>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index <= 0}
              aria-label="Newer overview"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              →
            </button>
          </div>
          <FeedbackBody content={current.contentEn} />
        </div>
      ) : null}

      {generating ? (
        <div className="mx-auto mb-5 flex max-w-5xl items-center justify-center gap-2 rounded-2xl border border-edt-indigo/25 bg-white p-6">
          <span className="h-2 w-2 animate-bounce rounded-full bg-edt-indigo" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-edt-gold [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-edt-indigo [animation-delay:300ms]" />
          <span className="ml-2 text-sm font-semibold text-edt-indigo">Generating class overview…</span>
        </div>
      ) : null}

      {error ? <p className="mx-auto mb-4 max-w-5xl text-center text-sm text-amber-700">{error}</p> : null}

      <div className="text-center">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={disabled}
          title={remaining != null && remaining <= 0 ? 'No AI overview uses left.' : undefined}
          className="inline-flex items-center gap-2 rounded-xl bg-edt-indigo px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#4f4e7d] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating
            ? 'Generating…'
            : `Generate Class Overview${remaining != null ? ` (${remaining} uses left)` : ''}`}
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
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [paperFilter, setPaperFilter] = useState<'01' | '02' | '03'>('01');
  const [detailAttemptId, setDetailAttemptId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPayload, setDetailPayload] = useState<import('../types').AttemptReportPayload | null>(null);

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
      setError('Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [session.teacherKey]);

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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="border-b border-edt-olive/20 bg-edt-forest px-4 py-4 text-edt-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-edt-neon">Teacher Dashboard</h1>
            <p className="text-sm text-edt-soft/70">
              Class: <span className="font-semibold text-edt-gold">{session.userGroup}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border border-edt-olive px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-edt-olive transition-colors hover:text-edt-soft disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-edt-olive px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-edt-olive transition-colors hover:text-edt-soft"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}

        {loading && !data ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading dashboard…</div>
        ) : null}

        {data ? (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Total Vouchers" value={data.totalVouchers} />
              <StatCard label="Used Vouchers" value={data.usedVouchers} />
              <StatCard label="Submissions" value={data.totalSubmissions} />
              <StatCard label="Overall Mean" value={fmt(data.overallMean)} sub="out of 90" />
              <StatCard label="Std Dev" value={fmt(data.overallStdDev)} />
            </div>

            {/* Overall Score Stats + Bar Chart */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">
                Overall Score Distribution
              </h2>
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Mean</p>
                  <p className="mt-1 text-2xl font-extrabold text-edt-forest">{fmt(data.overallMean)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Median</p>
                  <p className="mt-1 text-2xl font-extrabold text-edt-forest">{fmt(data.overallMedian)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Std Dev</p>
                  <p className="mt-1 text-2xl font-extrabold text-edt-forest">{fmt(data.overallStdDev)}</p>
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
                Dimension Performance (Mean Score / 5)
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.dimensionStats.map((dim) => (
                  <div key={dim.key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500">{dim.name}</p>
                    <p className="mt-2 text-xl font-bold text-edt-forest">
                      {fmt(dim.mean)} <span className="text-sm font-normal text-slate-400">/ 5</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">Std Dev: {fmt(dim.stdDev)}</p>
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
                    ['01', 'Paper I'],
                    ['02', 'Paper II'],
                    ['03', 'Paper III'],
                  ] as const
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setPaperFilter(code);
                      setDetailAttemptId(null);
                      setDetailPayload(null);
                    }}
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
                  Paper I Submissions ({data.totalSubmissions})
                </h2>
                <button
                  type="button"
                  onClick={toggleSubSort}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Submitted {subSortDir === 'desc' ? '↓ Newest' : '↑ Oldest'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2 whitespace-nowrap">Submitted At</th>
                      <th className="px-3 py-2 whitespace-nowrap">Candidate Name</th>
                      <th className="px-3 py-2 whitespace-nowrap">Candidate ID</th>
                      <th className="px-3 py-2 whitespace-nowrap">Test Date</th>
                      <th className="px-3 py-2 whitespace-nowrap">Score</th>
                      <th className="px-3 py-2 whitespace-nowrap">CEFR</th>
                      <th className="px-3 py-2">Weak Areas</th>
                      <th className="px-3 py-2">Recommendation</th>
                      <th className="px-3 py-2">AI Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-xs text-slate-400">
                          No submissions yet.
                        </td>
                      </tr>
                    ) : null}
                    {sortedSubmissions.map((sub) => (
                      <tr key={sub.submissionId} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">
                          {fmtDatetime(sub.submittedAt)}
                        </td>
                        <td className="px-3 py-3 text-xs font-medium">{sub.candidateName}</td>
                        <td className="px-3 py-3 font-mono text-xs">{sub.candidateId}</td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">{fmtDate(sub.testDate)}</td>
                        <td className="px-3 py-3 text-xs font-semibold">
                          {sub.totalScore}
                          <span className="font-normal text-slate-400">/90</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-edt-indigo/10 px-2 py-0.5 text-xs font-semibold text-edt-indigo">
                            {sub.cefr}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-rose-600">
                          {sub.weakDimensions.length > 0
                            ? sub.weakDimensions.join(', ')
                            : <span className="text-emerald-600">None</span>}
                        </td>
                        <td className="px-3 py-3 max-w-[240px] text-xs text-slate-500">{sub.recommendation || '—'}</td>
                        <td className="px-3 py-3 max-w-[220px] text-xs">
                          {sub.aiFeedback ? (
                            <span className="cursor-help text-edt-indigo" title={sub.aiFeedback}>
                              {aiSnippet(sub.aiFeedback)}
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
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
                {paperFilter === '02' ? 'Paper II Attempts' : 'Paper III Attempts'} (
                {(data.paperAttempts ?? []).filter((a) => a.testCode === paperFilter).length})
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Submitted</th>
                      <th className="px-3 py-2">Candidate</th>
                      <th className="px-3 py-2">Ref</th>
                      <th className="px-3 py-2">Overall band</th>
                      <th className="px-3 py-2">Parts</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.paperAttempts ?? [])
                      .filter((a) => a.testCode === paperFilter)
                      .map((row) => (
                        <tr key={row.attemptId} className="border-b border-slate-100 align-top">
                          <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-500">
                            {row.submittedAt ? fmtDatetime(row.submittedAt) : '—'}
                          </td>
                          <td className="px-3 py-3 text-xs font-medium">{row.candidateName}</td>
                          <td className="px-3 py-3 font-mono text-xs">{row.candidateRef}</td>
                          <td className="px-3 py-3 text-xs font-semibold">{row.overallBand ?? '—'}</td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {row.partBands.map((b) => `${b.partCode}:${b.cefrLabel}`).join(' · ') || '—'}
                          </td>
                          <td className="px-3 py-3 text-xs">{row.gradingStatus}</td>
                          <td className="px-3 py-3 text-xs">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-lg border border-edt-neon px-2 py-1 text-[10px] font-bold uppercase text-edt-forest"
                                onClick={() =>
                                  void downloadServerReportPdf(
                                    row.attemptId,
                                    'en',
                                    '',
                                    `EDT-Report_${row.testCode}_${row.attemptId}.pdf`,
                                    session.teacherKey,
                                  )
                                }
                              >
                                PDF
                              </button>
                              {paperFilter === '03' ? (
                                <button
                                  type="button"
                                  className="rounded-lg border border-edt-gold px-2 py-1 text-[10px] font-bold uppercase text-edt-forest"
                                  onClick={() => {
                                    setDetailAttemptId(row.attemptId);
                                    setDetailLoading(true);
                                    void fetchAttemptReportAsTeacher(row.attemptId, session.teacherKey)
                                      .then(setDetailPayload)
                                      .finally(() => setDetailLoading(false));
                                  }}
                                >
                                  Open report
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {paperFilter === '03' && detailAttemptId ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-edt-forest">Attempt detail</h3>
                  {detailLoading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
                  {detailPayload?.review?.map((r) => (
                    <div key={r.questionCode} className="mt-4 rounded-lg border border-white bg-white p-3">
                      <p className="text-xs font-semibold text-edt-olive">
                        Task {r.canonicalNumber} · {r.aiBandKey ?? '—'}
                      </p>
                      {r.audioUrl ? (
                        <audio
                          className="mt-2 w-full"
                          controls
                          src={`${r.audioUrl}`}
                          // Teacher auth via cookie not available; use fetch blob would be better —
                          // for now teachers open via authenticated fetch in a follow-up. Show essay always.
                        />
                      ) : null}
                      {r.textResponse ? (
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                          {r.textResponse}
                        </pre>
                      ) : null}
                      {r.transcriptText ? (
                        <p className="mt-2 text-xs text-slate-500">
                          <span className="font-semibold">Transcript: </span>
                          {r.transcriptText}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
            )}

            {paperFilter === '01' ? (
            /* Question Correctness Rate Table */
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                  Question Correctness Rate (90 Questions)
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
                    Sort: Lowest First ↑
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
                    Sort: Highest First ↓
                  </button>
                  {qSortDir ? (
                    <button
                      type="button"
                      onClick={() => setQSortDir(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Q#</th>
                      <th className="min-w-[280px] px-3 py-2">Question ID</th>
                      <th className="px-3 py-2">Part</th>
                      <th className="px-3 py-2">Responses</th>
                      <th className="px-3 py-2 w-48">Correct Rate</th>
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
                        <td className="px-3 py-2 text-xs">Part {q.part}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{q.totalResponses}</td>
                        <td className="px-3 py-2">
                          {q.correctRate == null ? (
                            <span className="text-xs text-slate-300">N/A</span>
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
                              Difficult
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
