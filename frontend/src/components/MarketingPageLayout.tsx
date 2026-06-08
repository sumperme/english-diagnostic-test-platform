import { useState } from 'react';
import { EdtNavBar } from './EdtNavBar';
import { PrimaryCTA } from './PrimaryCTA';
import { useLocale } from '../i18n/LocaleContext';
import { heroBackgroundStyle } from '../lib/landingAssets';
import type { MarketingPage } from '../types';

type MarketingContent = {
  tag: string;
  title: string;
  subtitle: string;
  cta: string;
  sections: ReadonlyArray<{ readonly heading: string; readonly body: string }>;
};

export function MarketingPageLayout({
  page,
  content,
  onNavigate,
  onLogin,
  onLogoClick,
  onTeacherLogin,
}: {
  page: MarketingPage;
  content: MarketingContent;
  onNavigate: (page: MarketingPage) => void;
  onLogin: () => void;
  onLogoClick: () => void;
  onTeacherLogin?: (key: string) => Promise<void>;
}) {
  const { t, language } = useLocale();
  const headingFont = language === 'zh-HK' ? 'font-zh' : 'font-display';

  const [teacherKey, setTeacherKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherError, setTeacherError] = useState('');

  const handleTeacherAccess = async () => {
    if (!teacherKey.trim() || !onTeacherLogin) return;
    setTeacherLoading(true);
    setTeacherError('');
    try {
      await onTeacherLogin(teacherKey.trim());
    } catch {
      setTeacherError(t.teacher.loginError);
    } finally {
      setTeacherLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-edt-forest text-edt-soft">
      <EdtNavBar
        variant="marketing"
        activePage={page}
        onNavigate={onNavigate}
        onLogin={onLogin}
        onLogoClick={onLogoClick}
      />

      <header className="-mt-nav bg-cover bg-center pb-16 pt-nav" style={heroBackgroundStyle}>
        <div className="mx-auto max-w-content px-6 md:px-10">
          <div className="ml-[10%] max-w-3xl">
            <div className="border-l-4 border-edt-neon pl-4 text-sm uppercase tracking-[0.22em] text-edt-neon">
              {content.tag}
            </div>
            <h1 className={`my-6 text-4xl leading-tight md:text-5xl ${headingFont}`}>{content.title}</h1>
            <p className="max-w-2xl text-base leading-8 text-edt-soft/85">{content.subtitle}</p>
            <PrimaryCTA onClick={onLogin} className="mt-10">
              {content.cta}
            </PrimaryCTA>

            {page === 'schools' && onTeacherLogin ? (
              <div className="mt-20 max-w-2xl border-t border-[rgba(130,129,109,0.2)] pt-16">
                <div className="border-l-4 border-edt-neon pl-4 text-sm uppercase tracking-[0.22em] text-edt-neon">
                  {t.teacher.loginLabel}
                </div>
                <h2 className={`my-6 text-4xl leading-tight md:text-5xl ${headingFont}`}>{t.teacher.loginTitle}</h2>
                <p className="max-w-2xl text-base leading-8 text-edt-soft/85">{t.teacher.loginHint}</p>

                <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-stretch">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={teacherKey}
                      onChange={(e) => setTeacherKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleTeacherAccess();
                      }}
                      placeholder={t.teacher.loginPlaceholder}
                      aria-label={t.teacher.loginPlaceholder}
                      className="h-full w-full border border-edt-olive/40 bg-[rgba(27,45,42,0.6)] px-4 py-4 text-sm text-edt-soft outline-none placeholder:text-edt-soft/40 focus:border-edt-neon"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-[0.12em] text-edt-olive transition-colors hover:text-edt-soft"
                      tabIndex={-1}
                    >
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <PrimaryCTA
                    tone="filled"
                    type="button"
                    onClick={() => void handleTeacherAccess()}
                    disabled={teacherLoading || !teacherKey.trim()}
                    className="shrink-0 px-6 py-2.5 sm:px-10"
                  >
                    {teacherLoading ? '…' : t.teacher.loginButton}
                  </PrimaryCTA>
                </div>
                {teacherError ? <p className="mt-3 text-sm text-rose-400">{teacherError}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="border-t border-[rgba(130,129,109,0.1)] py-20">
        <div className="mx-auto max-w-content space-y-16 px-6 md:px-10">
          {content.sections.map((section) => (
            <div key={section.heading} className="max-w-3xl">
              <h2 className={`mb-4 text-2xl text-edt-gold md:text-3xl ${headingFont}`}>{section.heading}</h2>
              <p className="text-base leading-8 text-edt-soft/80">{section.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 bg-[#0d1615] py-10 text-center text-xs text-edt-olive">
        {t.landing.footer}
      </footer>
    </div>
  );
}
