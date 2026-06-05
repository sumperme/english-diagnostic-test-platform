import { useLocale } from '../i18n/LocaleContext';

export function LeavePageModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t } = useLocale();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-edt-forest/80 p-4 backdrop-blur-sm">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl border border-[rgba(170,169,90,0.25)] bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-edt-indigo text-xl font-bold text-edt-gold">
            !
          </div>
          <h3 className="mb-2 font-display text-xl font-bold text-edt-forest">{t.quiz.leaveTitle}</h3>
          <p className="text-sm leading-relaxed text-edt-olive">{t.quiz.leaveBody}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-edt-olive px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-edt-olive transition-colors hover:border-edt-gold hover:text-edt-forest"
          >
            {t.quiz.leaveCancel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-edt-gold px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-edt-forest transition-all hover:bg-[#95944d]"
          >
            {t.quiz.leaveConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
