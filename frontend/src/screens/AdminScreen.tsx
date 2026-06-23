import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminLoginForm } from '../components/admin/AdminLoginForm';
import {
  clearAdminPassword,
  createAdminTeacherCredential,
  createAdminVoucher,
  deleteAdminTeacherCredential,
  fetchAdminSummary,
  fetchAdminTeacherCredentials,
  fetchAdminUserGroups,
  fetchAdminVouchers,
  loadAdminPassword,
  saveAdminPassword,
  updateAdminTeacherCredential,
  updateAdminVoucher,
} from '../lib/api';
import type { AdminSummary, AdminTeacherCredential, AdminVoucher } from '../types';

// ─── Voucher code generation ──────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789'; // A-N, P-Z, 0-9 (no O)

function randomSegment(): string {
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

function generateCode(): string {
  return `${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

function generateUniqueCodes(count: number, existing: Set<string>): string[] {
  const codes: string[] = [];
  const seen = new Set(existing);
  let attempts = 0;
  while (codes.length < count && attempts < count * 20) {
    attempts++;
    const code = generateCode();
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }
  return codes;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type VoucherDraft = {
  userGroup: string;
  educationLevel: string;
  remark: string;
  soldTo: string;
  usesAllowed: number;
};

type TeacherDraft = {
  remark: string;
};

type SortDir = 'asc' | 'desc' | null;

const DEFAULT_GROUP = 'General Learner';

function draftFromVoucher(voucher: AdminVoucher): VoucherDraft {
  return {
    userGroup: voucher.userGroup || DEFAULT_GROUP,
    educationLevel: voucher.educationLevel ?? '',
    remark: voucher.remark ?? '',
    soldTo: voucher.soldTo ?? '',
    usesAllowed: voucher.usesAllowed ?? 1,
  };
}

function draftFromTeacher(cred: AdminTeacherCredential): TeacherDraft {
  return { remark: cred.remark ?? '' };
}

function isDraftChanged(draft: VoucherDraft, voucher: AdminVoucher): boolean {
  const original = draftFromVoucher(voucher);
  return (
    draft.userGroup !== original.userGroup ||
    draft.educationLevel !== original.educationLevel ||
    draft.remark !== original.remark ||
    draft.soldTo !== original.soldTo ||
    draft.usesAllowed !== original.usesAllowed
  );
}

function formatVoucherStatus(voucher: AdminVoucher): string {
  const useCount = voucher.useCount ?? 0;
  const usesAllowed = voucher.usesAllowed ?? 1;
  if (useCount === 0) return 'Available';
  if (usesAllowed === 1) return 'Used';
  if (useCount >= usesAllowed) return `Used ${usesAllowed}/${usesAllowed}`;
  return `Used ${useCount}/${usesAllowed}`;
}

function voucherStatusBadgeClass(voucher: AdminVoucher): string {
  const useCount = voucher.useCount ?? 0;
  const usesAllowed = voucher.usesAllowed ?? 1;
  if (useCount === 0) return 'bg-emerald-100 text-emerald-700';
  if (usesAllowed > 1 && useCount < usesAllowed) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-700';
}

function isTeacherDraftChanged(draft: TeacherDraft, cred: AdminTeacherCredential): boolean {
  return draft.remark !== (cred.remark ?? '');
}

// ─── Main AdminScreen ─────────────────────────────────────────────────────────

export function AdminScreen() {
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'user-vouchers' | 'teacher-vouchers'>('user-vouchers');

  // Summary
  const [summary, setSummary] = useState<AdminSummary | null>(null);

  // Vouchers
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [drafts, setDrafts] = useState<Record<string, VoucherDraft>>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'used' | 'available'>('all');
  const [userGroupSortDir, setUserGroupSortDir] = useState<SortDir>(null);

  // Teacher credentials
  const [credentials, setCredentials] = useState<AdminTeacherCredential[]>([]);
  const [teacherDrafts, setTeacherDrafts] = useState<Record<string, TeacherDraft>>({});

  // Available user groups (from teacher_credentials)
  const [userGroups, setUserGroups] = useState<string[]>([DEFAULT_GROUP]);

  // Loading / messages
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Batch generate
  const [batchCount, setBatchCount] = useState(10);
  const [batchGroup, setBatchGroup] = useState(DEFAULT_GROUP);

  // Add teacher form
  const [newTeacherKey, setNewTeacherKey] = useState('');
  const [newTeacherGroup, setNewTeacherGroup] = useState('');
  const [newTeacherRemark, setNewTeacherRemark] = useState('');

  // Delete confirm
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadUserGroups = useCallback(async () => {
    try {
      const result = await fetchAdminUserGroups();
      setUserGroups(result.userGroups);
    } catch { /* silently fail */ }
  }, []);

  const loadVoucherData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [nextSummary, list] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminVouchers({ q: search, status, limit: 200 }),
      ]);
      setSummary(nextSummary);
      setVouchers(list.vouchers);
      setDrafts(Object.fromEntries(list.vouchers.map((v) => [v.code, draftFromVoucher(v)])));
    } catch {
      setMessage('Failed to load voucher data. Check password and try again.');
      setAuthenticated(false);
      clearAdminPassword();
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  const loadTeacherData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const list = await fetchAdminTeacherCredentials();
      setCredentials(list.credentials);
      setTeacherDrafts(Object.fromEntries(list.credentials.map((c) => [c.key, draftFromTeacher(c)])));
    } catch {
      setMessage('Failed to load teacher credentials.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = loadAdminPassword();
    if (saved) setAuthenticated(true);
  }, []);

  useEffect(() => {
    if (authenticated) {
      void loadVoucherData();
      void loadUserGroups();
    }
  }, [authenticated, loadVoucherData, loadUserGroups]);

  useEffect(() => {
    if (authenticated && activeTab === 'teacher-vouchers') {
      void loadTeacherData();
    }
  }, [authenticated, activeTab, loadTeacherData]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleLogin = (pw: string) => {
    saveAdminPassword(pw);
    setAuthenticated(true);
  };

  const logout = () => {
    clearAdminPassword();
    setAuthenticated(false);
    setSummary(null);
    setVouchers([]);
    setCredentials([]);
  };

  // ── Voucher operations ────────────────────────────────────────────────────

  const saveVoucher = async (code: string) => {
    const draft = drafts[code];
    if (!draft) return;
    setLoading(true);
    setMessage('');
    try {
      await updateAdminVoucher(code, {
        userGroup: draft.userGroup,
        educationLevel: draft.educationLevel || null,
        remark: draft.remark || null,
        soldTo: draft.soldTo || null,
        usesAllowed: Math.max(1, Math.floor(draft.usesAllowed)),
      });
      setMessage(`Saved ${code}.`);
      await loadVoucherData();
    } catch {
      setMessage(`Failed to save ${code}.`);
    } finally {
      setLoading(false);
    }
  };

  const batchGenerate = async () => {
    if (batchCount < 1 || batchCount > 200) return;
    setLoading(true);
    setMessage('');
    try {
      const existingCodes = new Set(vouchers.map((v) => v.code));
      const codes = generateUniqueCodes(batchCount, existingCodes);
      let added = 0;
      let failed = 0;
      for (const code of codes) {
        try {
          await createAdminVoucher({ code, userGroup: batchGroup || DEFAULT_GROUP });
          added++;
        } catch {
          failed++;
        }
      }
      setMessage(`Generated ${added} voucher(s)${failed > 0 ? `, ${failed} failed (duplicate)` : ''}.`);
      await loadVoucherData();
    } catch {
      setMessage('Failed to generate vouchers.');
    } finally {
      setLoading(false);
    }
  };

  // ── Teacher credential operations ─────────────────────────────────────────

  const addTeacherCredential = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTeacherKey.trim() || !newTeacherGroup.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      await createAdminTeacherCredential({
        key: newTeacherKey.trim(),
        userGroup: newTeacherGroup.trim().slice(0, 30),
        remark: newTeacherRemark.trim() || null,
      });
      setNewTeacherKey('');
      setNewTeacherGroup('');
      setNewTeacherRemark('');
      setMessage('Teacher credential added.');
      await Promise.all([loadTeacherData(), loadUserGroups(), loadVoucherData()]);
    } catch (err: any) {
      setMessage(err.message || 'Failed to add credential. Key or user group may already exist.');
    } finally {
      setLoading(false);
    }
  };

  const saveTeacherCredential = async (key: string) => {
    const draft = teacherDrafts[key];
    if (!draft) return;
    setLoading(true);
    setMessage('');
    try {
      await updateAdminTeacherCredential(key, { remark: draft.remark || null });
      setMessage(`Saved credential for ${key}.`);
      await loadTeacherData();
    } catch {
      setMessage(`Failed to save credential ${key}.`);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteTeacher = async (key: string) => {
    setLoading(true);
    setMessage('');
    try {
      await deleteAdminTeacherCredential(key);
      setDeleteConfirmKey(null);
      setMessage(`Deleted credential ${key}.`);
      // Reload everything: the worker has already reassigned affected vouchers to General Learner.
      await Promise.all([loadTeacherData(), loadUserGroups(), loadVoucherData()]);
    } catch {
      setMessage(`Failed to delete credential ${key}.`);
    } finally {
      setLoading(false);
    }
  };

  // ── Sorted vouchers ───────────────────────────────────────────────────────

  const sortedVouchers = (() => {
    if (!userGroupSortDir) return vouchers;
    return [...vouchers].sort((a, b) => {
      const cmp = a.userGroup.localeCompare(b.userGroup, 'en', { sensitivity: 'base' });
      return userGroupSortDir === 'asc' ? cmp : -cmp;
    });
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  if (!authenticated) {
    return <AdminLoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="border-b border-edt-olive/20 bg-edt-forest px-4 py-4 text-edt-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-edt-neon">EDT Voucher Admin</h1>
            <p className="text-sm text-edt-soft/70">Manage e-vouchers, user groups, and teacher credentials.</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-edt-olive px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-edt-olive transition-colors hover:text-edt-soft"
          >
            Sign out
          </button>
        </div>

        {/* Tab navigation */}
        <div className="mx-auto mt-4 flex max-w-[1400px] gap-1">
          {(['user-vouchers', 'teacher-vouchers'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-t-lg px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                activeTab === tab
                  ? 'bg-slate-100 text-edt-forest'
                  : 'text-edt-soft/70 hover:text-edt-soft'
              }`}
            >
              {tab === 'user-vouchers' ? 'User Vouchers' : 'Teacher Vouchers'}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
        {message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        {/* ── USER VOUCHERS TAB ─────────────────────────────────────── */}
        {activeTab === 'user-vouchers' ? (
          <>
            {/* Summary cards */}
            {summary ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Total vouchers', summary.total],
                  ['Used', summary.used],
                  ['Available', summary.available],
                  ['Assigned to party', summary.assigned],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                    <p className="mt-2 text-3xl font-extrabold text-edt-forest">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Batch Generate */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-slate-500">Batch Generate Vouchers</h2>
              <p className="mb-4 text-xs text-slate-400">
                Generates random codes in the format <span className="font-mono">XXXX-XXXX-XXXX</span> (A–N, P–Z, 0–9). All codes are unique and deduplicated against existing ones.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Count (1–200)</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={batchCount}
                    onChange={(e) => setBatchCount(Math.min(200, Math.max(1, Number(e.target.value))))}
                    className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">User Group</label>
                  <select
                    value={batchGroup}
                    onChange={(e) => setBatchGroup(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {userGroups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void batchGenerate()}
                    disabled={loading}
                    className="rounded-lg bg-edt-forest px-5 py-2 text-sm font-semibold text-edt-neon disabled:opacity-50 hover:bg-edt-indigo"
                  >
                    Generate & Add
                  </button>
                </div>
              </div>
            </section>

            {/* Voucher list */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Voucher List</h2>
                  <p className="mt-1 text-xs text-slate-400">Edit metadata and click Save on each row.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search code"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="available">Available</option>
                    <option value="used">Used</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadVoucherData()}
                    disabled={loading}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Uses allowed</th>
                      <th className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setUserGroupSortDir((d) =>
                              d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc',
                            )
                          }
                          className="flex items-center gap-1 hover:text-slate-700"
                        >
                          User Group
                          <span className="text-[10px]">
                            {userGroupSortDir === 'asc' ? '▲' : userGroupSortDir === 'desc' ? '▼' : '⇅'}
                          </span>
                        </button>
                      </th>
                      <th className="px-3 py-2">Education</th>
                      <th className="px-3 py-2">Sold to</th>
                      <th className="px-3 py-2">Remark</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVouchers.map((voucher) => {
                      const draft = drafts[voucher.code] ?? draftFromVoucher(voucher);
                      const changed = isDraftChanged(draft, voucher);
                      return (
                        <tr key={voucher.code} className="border-b border-slate-100 align-top">
                          <td className="px-3 py-3 font-mono text-xs">{voucher.code}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${voucherStatusBadgeClass(voucher)}`}>
                              {formatVoucherStatus(voucher)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={Math.max(1, voucher.useCount ?? 0)}
                              step={1}
                              value={draft.usesAllowed}
                              onChange={(e) => {
                                const next = Math.max(1, Math.floor(Number(e.target.value) || 1));
                                setDrafts((prev) => ({ ...prev, [voucher.code]: { ...draft, usesAllowed: next } }));
                              }}
                              className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={draft.userGroup}
                              onChange={(e) => {
                                setDrafts((prev) => ({ ...prev, [voucher.code]: { ...draft, userGroup: e.target.value } }));
                              }}
                              className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-1 text-xs"
                            >
                              {userGroups.map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                              {/* Keep current value if not in list */}
                              {!userGroups.includes(draft.userGroup) && (
                                <option value={draft.userGroup}>{draft.userGroup}</option>
                              )}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              value={draft.educationLevel}
                              onChange={(e) =>
                                setDrafts((prev) => ({ ...prev, [voucher.code]: { ...draft, educationLevel: e.target.value } }))
                              }
                              className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              value={draft.soldTo}
                              onChange={(e) =>
                                setDrafts((prev) => ({ ...prev, [voucher.code]: { ...draft, soldTo: e.target.value } }))
                              }
                              className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              value={draft.remark}
                              onChange={(e) =>
                                setDrafts((prev) => ({ ...prev, [voucher.code]: { ...draft, remark: e.target.value } }))
                              }
                              className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => void saveVoucher(voucher.code)}
                              disabled={loading || !changed}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                                changed
                                  ? 'bg-edt-neon text-edt-forest hover:bg-edt-gold'
                                  : 'cursor-default bg-slate-200 text-slate-400'
                              }`}
                            >
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        {/* ── TEACHER VOUCHERS TAB ──────────────────────────────────── */}
        {activeTab === 'teacher-vouchers' ? (
          <>
            {/* Add Teacher Credential */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-slate-500">Add Teacher Credential</h2>
              <p className="mb-4 text-xs text-slate-400">
                Each teacher credential key grants access to the Teacher Dashboard for the associated User Group (max 30 characters).
              </p>
              <form onSubmit={(e) => void addTeacherCredential(e)} className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Teacher's Credential Key</label>
                  <input
                    value={newTeacherKey}
                    onChange={(e) => setNewTeacherKey(e.target.value)}
                    placeholder="e.g. TEACHER-KEY-2026"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">User Group (max 30 chars)</label>
                  <input
                    value={newTeacherGroup}
                    onChange={(e) => setNewTeacherGroup(e.target.value.slice(0, 30))}
                    placeholder="e.g. Class-ENG101"
                    maxLength={30}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400">Remark (optional)</label>
                  <input
                    value={newTeacherRemark}
                    onChange={(e) => setNewTeacherRemark(e.target.value)}
                    placeholder="e.g. Ms Chan, ENG101 2026"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading || !newTeacherKey.trim() || !newTeacherGroup.trim()}
                    className="rounded-lg bg-edt-forest px-5 py-2 text-sm font-semibold text-edt-neon disabled:opacity-50 hover:bg-edt-indigo"
                  >
                    Add
                  </button>
                </div>
              </form>
            </section>

            {/* Teacher Credentials Table */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Teacher Credential List</h2>
                  <p className="mt-1 text-xs text-slate-400">One teacher key maps to one user group. Keys and user groups are fixed after creation.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadTeacherData()}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold"
                >
                  Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Teacher's Voucher Key</th>
                      <th className="px-3 py-2">User Group</th>
                      <th className="px-3 py-2 text-right"># Vouchers</th>
                      <th className="px-3 py-2 text-right">Used / Allowed</th>
                      <th className="px-3 py-2">Remark</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">
                          No teacher credentials yet.
                        </td>
                      </tr>
                    ) : null}
                    {credentials.map((cred) => {
                      const draft = teacherDrafts[cred.key] ?? draftFromTeacher(cred);
                      const changed = isTeacherDraftChanged(draft, cred);
                      const isDeleting = deleteConfirmKey === cred.key;
                      return (
                        <tr key={cred.key} className="border-b border-slate-100 align-top">
                          <td className="px-3 py-3 font-mono text-xs font-semibold">{cred.key}</td>
                          <td className="px-3 py-3 text-xs">
                            <span className="rounded-full bg-edt-indigo/10 px-2 py-0.5 text-xs font-semibold text-edt-indigo">
                              {cred.userGroup}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-xs font-semibold">{cred.voucherCount}</td>
                          <td className="px-3 py-3 text-right text-xs font-semibold">
                            {cred.totalUseCount}/{cred.totalUsesAllowed}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              value={draft.remark}
                              onChange={(e) =>
                                setTeacherDrafts((prev) => ({ ...prev, [cred.key]: { remark: e.target.value } }))
                              }
                              placeholder="Remark"
                              className="w-full min-w-[180px] rounded border border-slate-200 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void saveTeacherCredential(cred.key)}
                                disabled={loading || !changed}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                                  changed
                                    ? 'bg-edt-neon text-edt-forest hover:bg-edt-gold'
                                    : 'cursor-default bg-slate-200 text-slate-400'
                                }`}
                              >
                                Save
                              </button>
                              {isDeleting ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void confirmDeleteTeacher(cred.key)}
                                    disabled={loading}
                                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmKey(null)}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmKey(cred.key)}
                                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
