import { FormEvent, useEffect, useState } from 'react';
import { EdtNavBar } from '../components/EdtNavBar';
import { useLocale } from '../i18n/LocaleContext';
import { fetchTestAvailability } from '../lib/api';
import { heroBackgroundStyle } from '../lib/landingAssets';
import type { CandidateInfo, MarketingPage, TestAvailability } from '../types';

const PAPER_CODES = ['01', '02'] as const;

export function InfoScreen({
  userGroup,
  tests,
  sessionToken,
  onNext,
  onNavigate,
  onLogin,
  onLogoClick,
}: {
  userGroup: string;
  tests?: TestAvailability[];
  sessionToken?: string;
  onNext: (info: CandidateInfo) => void;
  onNavigate: (page: MarketingPage) => void;
  onLogin: () => void;
  onLogoClick: () => void;
}) {
  const { t, language } = useLocale();
  const headingFont = language === 'zh-HK' ? 'font-zh' : 'font-display';
  const [name, setName] = useState('');
  const [cid, setCid] = useState('');

  // Live per-test remaining uses: the session's login-time list goes stale
  // after a submission, so refetch whenever this screen mounts.
  const [freshTests, setFreshTests] = useState<TestAvailability[] | null>(null);
  useEffect(() => {
    if (!sessionToken) return undefined;
    let cancelled = false;
    fetchTestAvailability(sessionToken)
      .then((next) => {
        if (!cancelled) setFreshTests(next);
      })
      .catch(() => {
        // Keep the login-time snapshot when the refresh fails.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const effectiveTests = freshTests ?? tests;

  const availability = (code: string): number | null => {
    if (!effectiveTests) return null;
    const entry = effectiveTests.find((test) => test.testCode === code);
    return entry ? entry.remainingUses : code === '01' ? 1 : 0;
  };
  const isSelectable = (code: string) => {
    const remaining = availability(code);
    return remaining === null || remaining > 0;
  };
  const [testCode, setTestCode] = useState<string>(() => PAPER_CODES.find(isSelectable) ?? '01');

  // If the refreshed list exhausts the selected paper — or drops it entirely
  // (e.g. the test was deactivated) — move to one still available.
  useEffect(() => {
    if (!freshTests) return;
    setTestCode((current) => {
      const entry = freshTests.find((test) => test.testCode === current);
      if (entry && entry.remainingUses > 0) return current;
      const firstAvailable = PAPER_CODES.find((code) => {
        const paper = freshTests.find((test) => test.testCode === code);
        return paper ? paper.remainingUses > 0 : false;
      });
      return firstAvailable ?? current;
    });
  }, [freshTests]);

  const go = (event: FormEvent) => {
    event.preventDefault();
    onNext({
      name: name.trim() || 'Anonymous Candidate',
      id: cid.trim() || 'N/A',
      testDate: Date.now(),
      mode: 'Online',
      userGroup,
      testCode,
    });
  };

  return (
    <div className="min-h-screen bg-edt-forest text-edt-soft">
      <EdtNavBar variant="marketing" onNavigate={onNavigate} onLogin={onLogin} onLogoClick={onLogoClick} />

      <header className="-mt-nav bg-cover bg-center pb-20 pt-nav" style={heroBackgroundStyle}>
        <div className="mx-auto w-full max-w-content px-6 md:px-10">
          <div className="mx-auto w-full max-w-[1200px] animate-fade-in">
            <div className="mb-8">
              <div className="border-l-4 border-edt-neon pl-4 text-sm uppercase tracking-[0.22em] text-edt-neon">
                CEFR C1 / C2
              </div>
              <h1 className={`my-5 text-4xl leading-tight md:text-5xl ${headingFont}`}>{t.info.title}</h1>
              <div className="mb-4 inline-flex items-center rounded-full border border-[rgba(170,169,90,0.35)] bg-edt-forest/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-edt-neon">
                {t.info.userGroup}: {userGroup}
              </div>
              <p className="max-w-xl text-base leading-7 text-edt-soft/85">{t.info.subtitle}</p>
            </div>

            <form
              onSubmit={go}
              className="space-y-6 rounded-2xl border border-[rgba(170,169,90,0.2)] bg-white p-7 shadow-lg md:p-8"
            >
              {/* Paper picker first — dominant selection, scales to a third card later */}
              <div>
                <label className="mb-1 block text-sm font-bold uppercase tracking-[0.12em] text-edt-forest">
                  {t.test2.pickerTitle}
                </label>
                <p className="mb-4 text-xs text-edt-olive">{t.test2.pickerHint}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PAPER_CODES.map((code) => {
                    const remaining = availability(code);
                    const selectable = isSelectable(code);
                    const selected = testCode === code;
                    const intro = t.test2.paperIntros[code];
                    return (
                      <label
                        key={code}
                        className={`flex min-h-[220px] cursor-pointer flex-col rounded-2xl border-2 px-5 py-5 transition-all ${
                          selected
                            ? 'border-edt-gold bg-edt-gold/10 ring-2 ring-edt-gold/40'
                            : selectable
                              ? 'border-slate-200 hover:border-edt-gold/60 hover:shadow-md'
                              : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paper"
                          value={code}
                          checked={selected}
                          disabled={!selectable}
                          onChange={() => setTestCode(code)}
                          className="sr-only"
                        />
                        <span className="text-base font-bold leading-snug text-edt-forest">{t.test2.paperNames[code]}</span>
                        <span className="mt-1 text-xs font-semibold text-edt-gold">{t.test2.paperDescs[code]}</span>
                        <p className="mt-3 flex-1 text-xs leading-relaxed text-edt-olive">{intro.summary}</p>
                        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                          {intro.details.map((detail) => (
                            <li key={detail} className="text-[11px] leading-relaxed text-slate-500">
                              · {detail}
                            </li>
                          ))}
                        </ul>
                        <span
                          className={`mt-3 text-xs font-semibold ${selectable ? 'text-emerald-700' : 'text-rose-600'}`}
                        >
                          {remaining === null
                            ? '\u00A0'
                            : selectable
                              ? `${remaining} ${t.test2.remainingUses}`
                              : t.test2.noRemaining}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Inputs and buttons stay at a comfortable width inside the wide card. */}
              <div className="mx-auto w-full max-w-2xl space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-edt-forest">{t.info.name}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. CHAN TAI MAN JACKIE"
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-edt-forest outline-none transition-colors focus:border-edt-gold"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-edt-forest">
                    {t.info.id} <span className="text-xs font-normal text-edt-olive">({t.info.optional})</span>
                  </label>
                  <input
                    type="text"
                    value={cid}
                    onChange={(event) => setCid(event.target.value)}
                    placeholder="e.g. A28330124"
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-edt-forest outline-none transition-colors focus:border-edt-gold"
                  />
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-[rgba(170,169,90,0.35)] bg-edt-indigo/10 px-4 py-3">
                  <span className="mt-0.5 text-edt-gold">!</span>
                  <p className="text-sm leading-relaxed text-edt-olive">{t.info.warning}</p>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-edt-forest py-3.5 text-base font-bold uppercase tracking-[0.1em] text-edt-neon transition-colors hover:bg-[#243b37]"
                >
                  {t.info.start}
                </button>
              </div>
            </form>
          </div>
        </div>
      </header>

      <footer className="border-t border-white/5 bg-[#0d1615] py-10 text-center text-xs text-edt-olive">
        {t.landing.footer}
      </footer>
    </div>
  );
}
