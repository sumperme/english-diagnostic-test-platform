import { FormEvent, useState } from 'react';
import { EdtNavBar } from '../components/EdtNavBar';
import { useLocale } from '../i18n/LocaleContext';
import { heroBackgroundStyle } from '../lib/landingAssets';
import type { CandidateInfo, MarketingPage } from '../types';

export function InfoScreen({
  onNext,
  onNavigate,
  onLogin,
  onLogoClick,
}: {
  onNext: (info: CandidateInfo) => void;
  onNavigate: (page: MarketingPage) => void;
  onLogin: () => void;
  onLogoClick: () => void;
}) {
  const { t, language } = useLocale();
  const headingFont = language === 'zh-HK' ? 'font-zh' : 'font-display';
  const [name, setName] = useState('');
  const [cid, setCid] = useState('');

  const go = (event: FormEvent) => {
    event.preventDefault();
    onNext({
      name: name.trim() || 'Anonymous Candidate',
      id: cid.trim() || 'N/A',
      testDate: Date.now(),
      mode: 'Online',
    });
  };

  return (
    <div className="min-h-screen bg-edt-forest text-edt-soft">
      <EdtNavBar variant="marketing" onNavigate={onNavigate} onLogin={onLogin} onLogoClick={onLogoClick} />

      <header className="-mt-nav bg-cover bg-center pb-20 pt-nav" style={heroBackgroundStyle}>
        <div className="mx-auto w-full max-w-content px-6 md:px-10">
          <div className="mx-auto w-full max-w-2xl animate-fade-in">
            <div className="mb-10">
              <div className="border-l-4 border-edt-neon pl-4 text-sm uppercase tracking-[0.22em] text-edt-neon">
                CEFR C1 / C2
              </div>
              <h1 className={`my-5 text-4xl leading-tight md:text-5xl ${headingFont}`}>{t.info.title}</h1>
              <p className="max-w-xl text-base leading-8 text-edt-soft/85">{t.info.subtitle}</p>
            </div>

            <form
              onSubmit={go}
              className="space-y-5 rounded-2xl border border-[rgba(170,169,90,0.2)] bg-white p-7 shadow-lg md:p-8"
            >
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
