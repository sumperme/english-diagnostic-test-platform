import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  clearAdminPassword,
  createAdminVoucher,
  fetchAdminSummary,
  fetchAdminVouchers,
  loadAdminPassword,
  saveAdminPassword,
  updateAdminVoucher,
} from '../lib/api';
import type { AdminSummary, AdminVoucher } from '../types';

type VoucherDraft = {
  userGroup: string;
  educationLevel: string;
  remark: string;
  soldTo: string;
};

const DEFAULT_GROUP = 'General Learner';

function draftFromVoucher(voucher: AdminVoucher): VoucherDraft {
  return {
    userGroup: voucher.userGroup || DEFAULT_GROUP,
    educationLevel: voucher.educationLevel ?? '',
    remark: voucher.remark ?? '',
    soldTo: voucher.soldTo ?? '',
  };
}

export function AdminScreen() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [drafts, setDrafts] = useState<Record<string, VoucherDraft>>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'used' | 'available'>('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newGroup, setNewGroup] = useState(DEFAULT_GROUP);
  const [newEducation, setNewEducation] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [newSoldTo, setNewSoldTo] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [nextSummary, list] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminVouchers({ q: search, status, limit: 200 }),
      ]);
      setSummary(nextSummary);
      setVouchers(list.vouchers);
      setDrafts(Object.fromEntries(list.vouchers.map((voucher) => [voucher.code, draftFromVoucher(voucher)])));
    } catch {
      setMessage('Failed to load admin data. Check password and try again.');
      setAuthenticated(false);
      clearAdminPassword();
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const saved = loadAdminPassword();
    if (saved) {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      void loadData();
    }
  }, [authenticated, loadData]);

  const login = (event: FormEvent) => {
    event.preventDefault();
    setLoginError('');
    saveAdminPassword(password);
    setAuthenticated(true);
  };

  const logout = () => {
    clearAdminPassword();
    setAuthenticated(false);
    setPassword('');
    setSummary(null);
    setVouchers([]);
  };

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
      });
      setMessage(`Saved ${code}.`);
      await loadData();
    } catch {
      setMessage(`Failed to save ${code}.`);
    } finally {
      setLoading(false);
    }
  };

  const addVoucher = async (event: FormEvent) => {
    event.preventDefault();
    if (!newCode.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      await createAdminVoucher({
        code: newCode.trim(),
        userGroup: newGroup.trim() || DEFAULT_GROUP,
        educationLevel: newEducation.trim() || null,
        remark: newRemark.trim() || null,
        soldTo: newSoldTo.trim() || null,
      });
      setNewCode('');
      setNewEducation('');
      setNewRemark('');
      setNewSoldTo('');
      setMessage(`Added voucher ${newCode.trim().toUpperCase()}.`);
      await loadData();
    } catch {
      setMessage('Failed to add voucher. It may already exist.');
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-edt-forest px-4 text-edt-soft">
        <form onSubmit={login} className="w-full max-w-md rounded-2xl border border-[rgba(170,169,90,0.25)] bg-[rgba(27,45,42,0.95)] p-8 shadow-lg">
          <h1 className="mb-2 font-display text-2xl font-bold text-edt-neon">EDT Admin</h1>
          <p className="mb-6 text-sm text-edt-soft/75">Enter the admin password to manage e-vouchers.</p>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-edt-olive">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-4 w-full rounded-xl border border-edt-olive/40 bg-edt-forest px-4 py-3 text-edt-soft outline-none focus:border-edt-neon"
            autoFocus
          />
          {loginError ? <p className="mb-3 text-sm text-rose-400">{loginError}</p> : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-edt-gold py-3 text-sm font-bold uppercase tracking-[0.1em] text-edt-forest transition-colors hover:bg-edt-neon"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="border-b border-edt-olive/20 bg-edt-forest px-4 py-4 text-edt-soft">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-edt-neon">EDT Voucher Admin</h1>
            <p className="text-sm text-edt-soft/70">Manage e-vouchers, user groups, and sales remarks.</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-edt-olive px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-edt-olive transition-colors hover:text-edt-soft"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
        {message ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}

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

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">Add voucher</h2>
          <form onSubmit={addVoucher} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Voucher code" className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm" />
            <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="User group" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input value={newEducation} onChange={(e) => setNewEducation(e.target.value)} placeholder="Education level" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input value={newSoldTo} onChange={(e) => setNewSoldTo(e.target.value)} placeholder="Sold to (party)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input value={newRemark} onChange={(e) => setNewRemark(e.target.value)} placeholder="Remark" className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
            <button type="submit" disabled={loading || !newCode.trim()} className="rounded-lg bg-edt-forest px-4 py-2 text-sm font-semibold text-edt-neon disabled:opacity-50">
              Add voucher
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Voucher list</h2>
              <p className="mt-1 text-xs text-slate-400">Edit metadata and click Save on each row.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="used">Used</option>
              </select>
              <button type="button" onClick={() => void loadData()} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">
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
                  <th className="px-3 py-2">User group</th>
                  <th className="px-3 py-2">Education</th>
                  <th className="px-3 py-2">Sold to</th>
                  <th className="px-3 py-2">Remark</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => {
                  const draft = drafts[voucher.code] ?? draftFromVoucher(voucher);
                  return (
                    <tr key={voucher.code} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 font-mono text-xs">{voucher.code}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${voucher.used ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {voucher.used ? 'Used' : 'Available'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={draft.userGroup}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [voucher.code]: { ...draft, userGroup: e.target.value } }))
                          }
                          className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-1 text-xs"
                        />
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
                          disabled={loading}
                          className="rounded-lg bg-edt-gold px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-edt-forest"
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
      </main>
    </div>
  );
}
