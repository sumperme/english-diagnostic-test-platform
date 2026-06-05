import { LocaleSwitcher } from './LocaleSwitcher';
import { PrimaryCTA } from './PrimaryCTA';
import { useLocale } from '../i18n/LocaleContext';
import type { MarketingPage } from '../types';

const MARKETING_PAGES: MarketingPage[] = ['learners', 'schools', 'universities', 'collaboration'];

type EdtNavBarProps = {
  variant: 'marketing' | 'app';
  onLogoClick?: () => void;
  onNavigate?: (page: MarketingPage) => void;
  activePage?: MarketingPage | 'landing';
  onLogin?: () => void;
  backLabel?: 'home' | 'back';
  onBack?: () => void;
};

export function EdtNavBar({
  variant,
  onLogoClick,
  onNavigate,
  activePage,
  onLogin,
  backLabel = 'home',
  onBack,
}: EdtNavBarProps) {
  const { t } = useLocale();

  const logoClass =
    'font-display text-3xl font-bold tracking-[0.12em] text-edt-neon transition-colors hover:text-edt-soft';

  const navLabel = (page: MarketingPage) => {
    const labels: Record<MarketingPage, string> = {
      learners: t.nav.learners,
      schools: t.nav.schools,
      universities: t.nav.universities,
      collaboration: t.nav.collaboration,
    };
    return labels[page];
  };

  return (
    <>
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(130,129,109,0.2)] bg-[rgba(27,45,42,0.95)] py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-content items-center justify-between gap-6 px-6 md:px-10">
        <div className="flex min-w-0 flex-1 items-center gap-6 lg:gap-10">
          {onLogoClick ? (
            <button type="button" onClick={onLogoClick} className={`flex-shrink-0 ${logoClass}`}>
              EDT
            </button>
          ) : (
            <a className={`flex-shrink-0 ${logoClass}`} href="/">
              EDT
            </a>
          )}

          {variant === 'app' && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex-shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-edt-olive transition-colors hover:text-edt-gold"
            >
              ← {backLabel === 'back' ? t.nav.back : t.nav.home}
            </button>
          ) : null}

          {variant === 'marketing' ? (
            <div className="hidden min-w-0 gap-6 lg:flex">
              {MARKETING_PAGES.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => onNavigate?.(page)}
                  className={`text-xs font-normal uppercase tracking-[0.14em] transition-colors ${
                    activePage === page ? 'text-edt-neon' : 'text-edt-soft hover:text-edt-neon'
                  }`}
                >
                  {navLabel(page)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center gap-4">
          <LocaleSwitcher />
          {variant === 'marketing' && onLogin ? (
            <PrimaryCTA tone="filled" onClick={onLogin} className="hidden px-6 py-2.5 md:inline-flex">
              {t.nav.login}
            </PrimaryCTA>
          ) : null}
        </div>
      </div>
    </nav>
    <div className="h-nav shrink-0" aria-hidden="true" />
    </>
  );
}
