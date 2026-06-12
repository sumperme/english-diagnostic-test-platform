import { useLocale } from '../i18n/LocaleContext';

export function ConfirmModal({
  answeredCount,
  total,
  onConfirm,
  onCancel,
}: {
  answeredCount: number;
  total: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const unanswered = total - answeredCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            ?
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-800">{t.quiz.submitTitle}</h3>
          <p className="text-sm leading-relaxed text-slate-500">
            {answeredCount} / {total} {t.quiz.answered}
            {unanswered > 0 ? (
              <span className="font-medium text-amber-600">
                . {unanswered} {t.report.unanswered}
              </span>
            ) : null}{' '}
            {t.quiz.submitBody}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            {t.quiz.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-sky-600"
          >
            {t.quiz.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
