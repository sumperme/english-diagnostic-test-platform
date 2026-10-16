import { EdtFooter } from '../components/EdtFooter';
import { EdtNavBar, marketingHeroOffsetClass } from '../components/EdtNavBar';
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

      <header className={`${marketingHeroOffsetClass} flex min-h-screen items-center bg-cover bg-center`} style={heroBackgroundStyle}>
        <div className="mx-auto w-full max-w-content px-6 md:px-10">
          <div className="ml-[10%] max-w-2xl">
            <div className="border-l-4 border-edt-neon pl-4 text-sm uppercase tracking-[0.22em] text-edt-neon">
              {t.landing.tag}
            </div>
            <h1 className="my-6 font-sans text-5xl leading-tight md:text-6xl">{t.landing.title}</h1>
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

      <section id="papers" className="border-t border-[rgba(130,129,109,0.1)] py-20 md:py-24">
        <div className="mx-auto max-w-content px-6 md:px-10">
          <div className="mb-14 max-w-3xl">
            <div className="border-l-4 border-edt-neon pl-4 text-sm uppercase tracking-[0.22em] text-edt-neon">
              {t.landing.papersTag}
            </div>
            <h2 className={`mt-6 text-4xl md:text-5xl ${headingFont}`}>{t.landing.papersTitle}</h2>
            <p className="mt-5 text-base leading-8 text-edt-soft/80">{t.landing.papersSubtitle}</p>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {t.landing.papers.map((paper) => (
              <article
                key={paper.label}
                className="border border-[rgba(170,169,90,0.2)] bg-[rgba(27,45,42,0.5)] p-8 transition-all duration-300 hover:-translate-y-2.5 hover:border-edt-neon"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-edt-neon">{paper.label}</div>
                <h3 className={`mt-4 text-2xl text-edt-gold ${headingFont}`}>{paper.name}</h3>
                <p className="mt-4 text-sm leading-7 text-edt-soft/85">{paper.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="testimonials border-t border-[rgba(130,129,109,0.1)] bg-[rgba(65,64,102,0.1)] py-20">
        <div className="mx-auto max-w-content px-6 md:px-10">
          <div className="text-center">
            <h2 className={`text-4xl md:text-5xl ${headingFont}`}>{t.landing.testimonialsTitle}</h2>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-2">
            {t.landing.testimonials.map((testimonial) => (
              <article
                key={testimonial.author}
                className="border-l-2 border-edt-gold bg-[rgba(27,45,42,0.5)] p-10"
              >
                <p className="mb-5 text-lg italic leading-8 text-edt-soft">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="text-sm font-semibold uppercase tracking-[0.12em] text-edt-neon">{testimonial.author}</div>
              </article>
            ))}
          </div>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-12 opacity-70">
            <div className="w-full border-t border-[rgba(170,169,90,0.3)] pt-5 text-center font-display text-xl text-edt-gold">
              {t.landing.supportingOrgLabel}
              <br />
              {t.landing.supportingOrgName}
            </div>
          </div>
        </div>
      </section>

      <EdtFooter onLogoClick={onLogoClick} onNavigate={onNavigate} />
    </div>
  );
}
