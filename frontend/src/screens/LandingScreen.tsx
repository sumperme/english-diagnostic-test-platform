import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { PrimaryCTA } from '../components/PrimaryCTA';
import { VisualCard } from '../components/VisualCard';
import { useLocale } from '../i18n/LocaleContext';

const heroImage = 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=1920';
const reportImage = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=1000';
const cardImages = [
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1454165833767-0266b196773b?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800',
];

export function LandingScreen({ onStart }: { onStart: () => void }) {
  const { t, language } = useLocale();
  const headingFont = language === 'zh-HK' ? 'font-zh' : 'font-display';

  return (
    <div className="min-h-screen bg-edt-forest text-edt-soft">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(130,129,109,0.2)] bg-[rgba(27,45,42,0.95)] py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1300px] items-center justify-between gap-6 px-6 md:px-10">
          <div className="flex items-center gap-10">
            <a className="font-display text-3xl font-bold tracking-[0.12em] text-edt-neon" href="/">
              EDT
            </a>
            <div className="hidden gap-6 lg:flex">
              {[t.nav.learners, t.nav.schools, t.nav.universities, t.nav.collaboration].map((item) => (
                <a key={item} className="text-xs font-normal uppercase tracking-[0.14em] text-edt-soft transition-colors hover:text-edt-neon" href="#how">
                  {item}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <PrimaryCTA tone="filled" onClick={onStart} className="hidden px-6 py-2.5 md:inline-flex">
              {t.nav.login}
            </PrimaryCTA>
          </div>
        </div>
      </nav>

      <header
        className="flex min-h-screen items-center bg-cover bg-center pt-20"
        style={{
          backgroundImage: `linear-gradient(to right, #1B2D2A 40%, rgba(27,45,42,0) 100%), url(${heroImage})`,
        }}
      >
        <div className="mx-auto w-full max-w-[1300px] px-6 md:px-10">
          <div className="max-w-2xl">
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
        <div className="mx-auto grid max-w-[1300px] items-center gap-16 px-6 lg:grid-cols-2 md:px-10">
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
        <div className="mx-auto max-w-[1300px] px-6 md:px-10">
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
