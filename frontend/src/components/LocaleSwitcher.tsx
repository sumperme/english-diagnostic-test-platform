import { useLocale } from '../i18n/LocaleContext';
import type { Language } from '../types';

export function LocaleSwitcher() {
  const { language, setLanguage } = useLocale();

  return (
    <select
      value={language}
      onChange={(event) => setLanguage(event.target.value as Language)}
      className="border border-edt-olive bg-transparent px-2.5 py-1 text-xs uppercase text-edt-olive outline-none transition-colors hover:text-edt-soft"
      aria-label="Select language"
    >
      <option value="en">EN</option>
      <option value="zh-HK">繁</option>
    </select>
  );
}
