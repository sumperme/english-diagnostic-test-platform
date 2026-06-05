import { EdtNavBar } from '../components/EdtNavBar';
import { PrimaryCTA } from '../components/PrimaryCTA';
import { VisualCard } from '../components/VisualCard';
import { useLocale } from '../i18n/LocaleContext';
import { cardImages, heroBackgroundStyle, reportImage } from '../lib/landingAssets';
import type { MarketingPage } from '../types';

export function LandingScreen({
  onStart,
  onNavigate,
  onLogoClick,
}: {
  onStart: () => void;
  onNavigate: (page: MarketingPage) => void;
  onLogoClick: () => void;
}) {
  const { t, language } = useLocale();
  const headingFont = language === 'zh-HK' ? 'font-zh' : 'font-display';

  return (
    <div className="min-h-screen bg-edt-forest text-edt-soft">
      <EdtNavBar variant="marketing" activePage="landing" onNavigate={onNavigate} onLogin={onStart} onLogoClick={onLogoClick} />

      <header className="-mt-nav flex min-h-screen items-center bg-cover bg-center pt-nav" style={heroBackgroundStyle}>
        <div className="mx-auto w-full max-w-content px-6 md:px-10">
          <div className="ml-[10%] max-w-2xl">
            <div className="border-l-4 border-edt-neon pl-4 text-sm uppercase tracking-[0.22em] text-edt-neon">
              {t.landing.tag}
            </div>
            <h1 className={`my-6 text-5xl leading-tight md:text-6xl ${headingFont}`}>{t.landing.title}</h1>
            <p className="max-w-xl text-base leading-8 text-edt-soft/85">{t.landing.subtitle}</p>
            <PrimaryCTA onClick={onStart} className="mt-10">
              {t.landing.cta}
            </PrimaryCTA>
          </div>
        </div>
      </header>

      <section className="border-t border-[rgba(130,129,109,0.1)] py-24">
        <div className="mx-auto grid max-w-content items-center gap-16 px-6 lg:grid-cols-2 md:px-10">
          <div>
            <h2 className={`mb-5 text-4xl text-edt-gold md:text-5xl ${headingFont}`}>{t.landing.reportTitle}</h2>
            <p className="text-base leading-8 text-edt-soft/80">{t.landing.reportBody}</p>
            <p className="mt-5 italic text-edt-neon">{t.landing.reportQuote}</p>
          </div>
          <div className="relative flex h-[400px] items-center justify-center overflow-hidden bg-edt-indigo">
            <img className="h-full w-full object-cover opacity-60" src={reportImage} alt="" />
            <div className="absolute font-bold uppercase tracking-[0.18em] text-white">{t.landing.reportPreview}</div>
          </div>
        </div>
      </section>

      <section id="how" className="py-20">
        <div className="mx-auto max-w-content px-6 md:px-10">
          <div className="mb-14 text-center">
            <h2 className={`text-4xl md:text-5xl ${headingFont}`}>{t.landing.howTitle}</h2>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {t.landing.steps.map((step, index) => (
              <VisualCard key={step.title} image={cardImages[index]} step={`0${index + 1}`} title={step.title}>
                <p>{step.body}</p>
              </VisualCard>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 bg-[#0d1615] py-10 text-center text-xs text-edt-olive">
        {t.landing.footer}
      </footer>
    </div>
  );
}
