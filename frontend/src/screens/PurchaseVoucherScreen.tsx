import { EdtNavBar } from '../components/EdtNavBar';
import { PlanCard } from '../components/PlanCard';
import { useLocale } from '../i18n/LocaleContext';
import { heroBackgroundStyle } from '../lib/landingAssets';

export function PurchaseVoucherScreen({ onHome }: { onHome: () => void }) {
  const { t, language } = useLocale();
  const headingFont = language === 'zh-HK' ? 'font-zh' : 'font-display';

  return (
    <div className="min-h-screen bg-edt-forest text-edt-soft">
      <EdtNavBar variant="app" onLogoClick={onHome} onBack={onHome} />

      <header className="-mt-nav bg-cover bg-center pb-16 pt-nav" style={heroBackgroundStyle}>
        <div className="mx-auto max-w-content px-6 text-center md:px-10">
          <div className="border-l-4 border-edt-neon pl-4 text-left text-sm uppercase tracking-[0.22em] text-edt-neon md:mx-auto md:inline-block md:border-l-0 md:pl-0">
            {t.purchase.tag}
          </div>
          <h1 className={`my-6 text-4xl leading-tight md:text-5xl ${headingFont}`}>{t.purchase.title}</h1>
          <p className="mx-auto max-w-2xl text-base leading-8 text-edt-soft/85">{t.purchase.subtitle}</p>
        </div>
      </header>

      <section className="border-t border-[rgba(130,129,109,0.1)] py-20">
        <div className="mx-auto max-w-content px-6 md:px-10">
          <p className="mb-12 text-center text-sm uppercase tracking-[0.18em] text-edt-olive">{t.purchase.selectPlan}</p>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.purchase.plans.map((plan, index) => (
              <PlanCard
                key={plan.name}
                name={plan.name}
                price={plan.price}
                features={[...plan.features]}
                cta={plan.cta}
                featured={index === 0}
                onClick={() => undefined}
              />
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
