import { useCallback, useEffect, useState } from 'react';
import { clearTeacherSession, fetchTeacherDashboard } from '../lib/api';
import type { TeacherDashboardData, TeacherQuestionStat, TeacherSession, TeacherSubmissionRow } from '../types';

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
              <StatCard label="Overall Mean" value={fmt(data.overallMean)} sub="out of 72" />
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

            {/* Student Submission Table */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                  Student Submissions ({data.totalSubmissions})
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
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-xs text-slate-400">
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
                          <span className="font-normal text-slate-400">/72</span>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Question Correctness Rate Table */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                  Question Correctness Rate (72 Questions)
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
                      <th className="px-3 py-2">Question ID</th>
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
                        <td className="px-3 py-2 font-mono text-xs font-semibold">{q.qid}</td>
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
          </>
        ) : null}
      </main>
    </div>
  );
}
