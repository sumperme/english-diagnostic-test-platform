import { MarketingPageLayout } from '../components/MarketingPageLayout';
import { useLocale } from '../i18n/LocaleContext';
import type { MarketingPage } from '../types';

export function MarketingScreen({
  page,
  anchor,
  onNavigate,
  onLogin,
  onLogoClick,
  onTeacherLogin,
}: {
  page: MarketingPage;
  anchor?: string;
  onNavigate: (page: MarketingPage, anchor?: string) => void;
  onLogin: () => void;
  onLogoClick: () => void;
  onTeacherLogin?: (key: string) => Promise<void>;
}) {
  const { t } = useLocale();

  return (
    <MarketingPageLayout
      page={page}
      anchor={anchor}
      content={t.marketing[page]}
      onNavigate={onNavigate}
      onLogin={onLogin}
      onLogoClick={onLogoClick}
      onTeacherLogin={onTeacherLogin}
    />
  );
}
