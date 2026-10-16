import { useEffect, useState } from 'react';
import { EdtFooter } from './EdtFooter';
import { EdtNavBar, marketingHeroOffsetClass } from './EdtNavBar';
import { PrimaryCTA } from './PrimaryCTA';
import { useLocale } from '../i18n/LocaleContext';
import { heroBackgroundStyle, heroBackgroundStyleFor, universitiesHeroImage } from '../lib/landingAssets';
import { CONTACT_ANCHOR } from '../lib/marketingPages';
import type { MarketingPage } from '../types';

type MarketingSection = {
  /** Stable DOM id for cross-page anchor links; headings are localised and cannot be used. */
  readonly anchorId?: string;
  readonly heading: string;
  readonly body?: string;
  readonly bullets?: ReadonlyArray<string>;
  /** Closing paragraph rendered after the bullet list. */
  readonly note?: string;
};

type MarketingContent = {
  tag: string;
  title: string;
  subtitle: string;
  cta: string;
  /** Lead-in paragraphs shown above the sections, for long-form pages. */
  intro?: ReadonlyArray<string>;
  sections: ReadonlyArray<MarketingSection>;
};

export function MarketingPageLayout({
  page,
  anchor,
  content,
  onNavigate,
  onLogin,
  onLogoClick,
  onTeacherLogin,
}: {
  page: MarketingPage;
  anchor?: string;
  content: MarketingContent;
  onNavigate: (page: MarketingPage, anchor?: string) => void;
  onLogin: () => void;
  onLogoClick: () => void;
  onTeacherLogin?: (key: string) => Promise<void>;
}) {
  const { t, language } = useLocale();
  const headingFont = language === 'zh-HK' ? 'font-zh' : 'font-display';

  // Screens are state-based, so an anchor arriving with the page change is scrolled
  // to once the target section has rendered.
  // Both branches are deferred a frame so they run against the incoming page's
  // final layout: an immediate reset gets undone by the browser re-anchoring
  // after a tall page is swapped out, and an immediate jump measures the
  // outgoing page's height. Scrolling is instant rather than smooth because
  // these are page changes, not movement within one page.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!anchor) {
        window.scrollTo({ top: 0 });
        return;
      }
      document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, page]);

  // The enquiry CTA has no contact channel yet, so it points at the About Us
  // "Contact Us" section instead of the voucher flow.
  const handleCta = page === 'universities' ? () => onNavigate('about', CONTACT_ANCHOR) : onLogin;
  const showCta = page !== 'about';
  const heroStyle =
    page === 'universities' ? heroBackgroundStyleFor(universitiesHeroImage) : heroBackgroundStyle;

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

      <header className={`${marketingHeroOffsetClass} bg-cover bg-center pb-16`} style={heroStyle}>
        <div className="mx-auto max-w-content px-6 md:px-10">
          <div className="ml-[10%] max-w-3xl">
            <div className="border-l-4 border-edt-neon pl-4 text-sm uppercase tracking-[0.22em] text-edt-neon">
              {content.tag}
            </div>
            <h1 className={`my-6 text-4xl leading-tight md:text-5xl ${headingFont}`}>{content.title}</h1>
            <p className="max-w-2xl text-base leading-8 text-edt-soft/85">{content.subtitle}</p>
            {showCta ? (
              <PrimaryCTA onClick={handleCta} className="mt-10">
                {content.cta}
              </PrimaryCTA>
            ) : null}

            {page === 'teachers' && onTeacherLogin ? (
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
                      {showKey ? t.teacher.loginHideKey : t.teacher.loginShowKey}
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

      <section className="border-t border-[rgba(130,129,109,0.1)] py-20 md:py-24">
        <div className="mx-auto max-w-content px-6 md:px-10">
          {content.intro?.length ? (
            <div className="mb-16 space-y-6">
              {content.intro.map((paragraph) => (
                <p key={paragraph} className="text-base leading-8 text-edt-soft/80">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}
          <div className={page === 'about' ? 'grid grid-cols-1 gap-10 lg:grid-cols-2' : 'space-y-10'}>
            {content.sections.map((section, index) => (
              <article
                key={section.heading}
                id={section.anchorId}
                className={`scroll-mt-nav-marketing border-l-2 border-edt-gold bg-[rgba(27,45,42,0.5)] p-8 md:p-10 lg:scroll-mt-nav ${page === 'about' ? '' : 'max-w-3xl'}`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-edt-neon">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h2 className={`mb-4 mt-3 text-2xl text-edt-gold md:text-3xl ${headingFont}`}>{section.heading}</h2>
                {section.body ? <p className="text-base leading-8 text-edt-soft/80">{section.body}</p> : null}
                {section.bullets?.length ? (
                  <ul className="mt-5 space-y-3">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3 text-base leading-8 text-edt-soft/80">
                        <span aria-hidden="true" className="mt-3.5 h-1.5 w-1.5 shrink-0 bg-edt-neon" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.note ? <p className="mt-5 text-base leading-8 text-edt-soft/80">{section.note}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <EdtFooter onLogoClick={onLogoClick} onNavigate={onNavigate} />
    </div>
  );
}
