import { FormEvent, useRef, useState } from 'react';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { verifyVoucher } from '../lib/api';
import { saveSession } from '../lib/session';
import { useLocale } from '../i18n/LocaleContext';
import type { Session } from '../types';

export function VoucherScreen({ onSuccess, onBack }: { onSuccess: (session: Session) => void; onBack: () => void }) {
  const { t } = useLocale();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const session = await verifyVoucher(code.trim());
      saveSession(session);
      onSuccess(session);
    } catch {
      setError(t.voucher.invalid);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto flex max-w-5xl justify-between">
        <button onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
          EDT
        </button>
        <LocaleSwitcher />
      </div>
      <main className="mx-auto mt-16 w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-block rounded-full bg-edt-forest px-3 py-1 text-xs font-semibold uppercase tracking-wide text-edt-neon">
            CEFR C1 / C2
          </span>
          <h1 className="mb-2 text-3xl font-extrabold text-slate-800">{t.voucher.title}</h1>
          <p className="text-sm font-medium text-slate-500">{t.voucher.subtitle}</p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {t.voucher.summary.map((item) => (
              <div key={item} className="rounded-xl bg-slate-50 p-3">
                <p className="font-semibold text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-slate-700">{t.voucher.label}</label>
          <input
            ref={inputRef}
            type="password"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError('');
            }}
            placeholder={t.voucher.placeholder}
            className="mb-2 w-full rounded-xl border-2 border-slate-200 px-4 py-3 font-mono text-lg tracking-widest text-slate-800 outline-none transition-colors focus:border-edt-gold"
            autoFocus
          />
          {error ? <p className="mb-3 text-sm text-rose-500">{error}</p> : null}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="mt-1 w-full rounded-xl bg-edt-forest py-3.5 text-base font-bold text-edt-neon transition-colors hover:bg-[#243b37] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t.voucher.verifying : t.voucher.submit}
          </button>
        </form>
      </main>
    </div>
  );
}
