import { FormEvent, useRef, useState } from 'react';
import { EdtNavBar } from '../components/EdtNavBar';
import { verifyVoucher, ApiError } from '../lib/api';
import { saveSession } from '../lib/session';
import { useLocale } from '../i18n/LocaleContext';
import { heroBackgroundStyle } from '../lib/landingAssets';
import type { Session } from '../types';

export function VoucherScreen({
  onSuccess,
  onBack,
  onPurchase,
}: {
  onSuccess: (session: Session) => void;
  onBack: () => void;
  onPurchase: () => void;
}) {
  const { t } = useLocale();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
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
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ALREADY_USED') {
        setError(t.voucher.alreadyUsed);
      } else if (error instanceof ApiError && error.code === 'NOT_FOUND') {
        setError(t.voucher.notFound);
      } else {
        setError(t.voucher.invalid);
      }
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-edt-forest text-edt-soft">
      <EdtNavBar variant="app" onLogoClick={onBack} onBack={onBack} />

      <header
        className="-mt-nav flex min-h-[70vh] items-center bg-cover bg-center pb-16 pt-nav"
        style={heroBackgroundStyle}
      >
        <div className="mx-auto w-full max-w-content px-6 md:px-10">
          <main className="mx-auto w-full max-w-lg animate-fade-in">
            <div className="mb-8 text-center">
              <span className="mb-4 inline-block rounded-full border border-[rgba(170,169,90,0.3)] bg-edt-forest/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-edt-neon">
                CEFR C1 / C2
              </span>
              <h1 className="mb-2 font-display text-3xl font-bold text-edt-soft md:text-4xl">{t.voucher.title}</h1>
              <p className="text-sm leading-relaxed text-edt-soft/75">{t.voucher.subtitle}</p>
            </div>

            <div className="mb-6 rounded-2xl border border-[rgba(170,169,90,0.2)] bg-white p-6 shadow-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {t.voucher.summary.map((item) => (
                  <div key={item} className="rounded-xl bg-edt-forest/5 p-3">
                    <p className="font-semibold text-edt-forest">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={submit} className="rounded-2xl border border-[rgba(170,169,90,0.2)] bg-white p-6 shadow-lg">
              <label className="mb-2 block text-sm font-semibold text-edt-forest">{t.voucher.label}</label>
              <div className="relative mb-2">
                <input
                  ref={inputRef}
                  type={showCode ? 'text' : 'password'}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError('');
                  }}
                  placeholder={t.voucher.placeholder}
                  className="w-full rounded-xl border-2 border-slate-200 py-3 pl-4 pr-12 font-mono text-lg tracking-widest text-edt-forest outline-none transition-colors focus:border-edt-gold"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCode((visible) => !visible)}
                  aria-label={showCode ? t.voucher.hideCode : t.voucher.showCode}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-edt-olive transition-colors hover:bg-edt-gold/15 hover:text-edt-gold active:bg-edt-gold/25 active:text-edt-forest"
                >
                  {showCode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {error ? <p className="mb-3 text-sm text-rose-500">{error}</p> : null}
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="mt-1 w-full rounded-xl bg-edt-forest py-3.5 text-base font-bold uppercase tracking-[0.1em] text-edt-neon transition-colors hover:bg-[#243b37] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? t.voucher.verifying : t.voucher.submit}
              </button>
              <button
                type="button"
                onClick={onPurchase}
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-[rgba(170,169,90,0.35)] bg-edt-gold px-6 py-3.5 text-sm font-bold uppercase tracking-[0.1em] text-edt-forest transition-colors hover:border-edt-gold hover:bg-[#95944d] active:border-edt-olive active:bg-edt-olive active:text-edt-soft"
              >
                {t.voucher.purchase}
              </button>
            </form>
          </main>
        </div>
      </header>
    </div>
  );
}
