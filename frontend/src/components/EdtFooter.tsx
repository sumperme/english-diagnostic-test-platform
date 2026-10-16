import { useLocale } from '../i18n/LocaleContext';
import type { MarketingPage } from '../types';

const LINK_CLASS = 'text-sm text-edt-olive transition-colors hover:text-edt-soft';

export function EdtFooter({
  onLogoClick,
  onNavigate,
}: {
  onLogoClick?: () => void;
  onNavigate?: (page: MarketingPage) => void;
}) {
  const { t } = useLocale();

  return (
    <footer className="border-t border-white/5 bg-[#0d1615] px-6 pb-10 pt-20 md:px-10">
      <div className="mx-auto max-w-content">
        {/* Six tracks with a two-track brand block keeps all four link columns on one row at lg+. */}
        <div className="mb-16 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-6 lg:gap-x-8">
          <div className="sm:col-span-2">
            {onLogoClick ? (
              <button
                type="button"
                onClick={onLogoClick}
                className="font-display text-3xl font-bold tracking-[0.12em] text-edt-neon transition-colors hover:text-edt-soft"
              >
                EDT
              </button>
            ) : (
              <a
                href="/"
                className="font-display text-3xl font-bold tracking-[0.12em] text-edt-neon transition-colors hover:text-edt-soft"
              >
                EDT
              </a>
            )}
            <p className="mt-5 text-sm leading-7 text-edt-olive">{t.landing.footerTagline}</p>
          </div>
          {t.landing.footerColumns.map((column) => {
            const goesToAbout = column.id === 'about' && Boolean(onNavigate);
            return (
              <div key={column.id}>
                <h4 className="mb-6 text-sm uppercase tracking-[0.14em] text-edt-neon">
                  {goesToAbout ? (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('about')}
                      className="uppercase tracking-[0.14em] transition-colors hover:text-edt-soft"
                    >
                      {column.heading}
                    </button>
                  ) : (
                    column.heading
                  )}
                </h4>
                <ul className="space-y-3">
                  {column.links.map((link) => (
                    <li key={link}>
                      {goesToAbout ? (
                        <button type="button" onClick={() => onNavigate?.('about')} className={LINK_CLASS}>
                          {link}
                        </button>
                      ) : (
                        <a href="#" className={LINK_CLASS}>
                          {link}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/5 pt-10 text-center text-xs text-edt-olive">
          {t.landing.footerCopyright}
        </div>
      </div>
    </footer>
  );
}
