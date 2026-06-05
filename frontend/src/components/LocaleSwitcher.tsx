import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../i18n/LocaleContext';
import type { Language } from '../types';

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'zh-HK', label: '繁' },
];

export function LocaleSwitcher() {
  const { language, setLanguage } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = OPTIONS.find((option) => option.value === language)?.label ?? 'EN';

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (value: Language) => {
    setLanguage(value);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="border border-edt-olive bg-transparent px-2.5 py-1 text-xs uppercase text-edt-olive outline-none transition-colors hover:text-edt-soft"
        aria-label="Select language"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedLabel}
      </button>

      {isOpen ? (
        <ul
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full z-[60] mt-1 min-w-full overflow-hidden rounded-sm border border-edt-olive/80 bg-edt-olive shadow-lg"
        >
          {OPTIONS.map((option) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={language === option.value}
                onClick={() => handleSelect(option.value)}
                className={`w-full px-2.5 py-1.5 text-left text-xs uppercase text-edt-soft transition-colors hover:bg-edt-forest hover:text-edt-neon ${
                  language === option.value ? 'font-semibold text-edt-neon' : ''
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
