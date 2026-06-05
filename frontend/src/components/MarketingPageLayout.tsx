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
}: {
  page: MarketingPage;
  content: MarketingContent;
  onNavigate: (page: MarketingPage) => void;
  onLogin: () => void;
  onLogoClick: () => void;
}) {
  const { t, language } = useLocale();
  const headingFont = language === 'zh-HK' ? 'font-zh' : 'font-display';

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
