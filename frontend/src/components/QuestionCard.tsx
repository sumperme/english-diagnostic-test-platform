import type { ClipboardEvent, MouseEvent } from 'react';
import type { OptionKey, Question } from '../data/questions';

function blockCopyInteraction(event: ClipboardEvent | MouseEvent) {
  event.preventDefault();
}

export function QuestionCard({
  q,
  displayNumber,
  selected,
  onSelect,
  preventCopy = false,
}: {
  q: Question;
  displayNumber?: number;
  selected?: OptionKey;
  onSelect: (key: OptionKey) => void;
  preventCopy?: boolean;
}) {
  const copyGuardProps = preventCopy
    ? {
        onCopy: blockCopyInteraction,
        onCut: blockCopyInteraction,
        onContextMenu: blockCopyInteraction,
        onSelectStart: blockCopyInteraction,
      }
    : {};

  const questionNumber = displayNumber ?? q.canonicalNumber;

  return (
    <div
      {...copyGuardProps}
      className={`rounded-2xl border-2 bg-white p-6 transition-all ${
        selected ? 'border-sky-300 shadow-sm shadow-sky-100' : 'border-slate-100'
      } ${preventCopy ? 'select-none' : ''}`}
    >
      <div className={`mb-5 rounded-xl border border-slate-100 bg-slate-50/90 px-5 py-4 ${preventCopy ? 'select-none' : ''}`}>
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-bold text-slate-600 shadow-sm">
            Q{questionNumber}
          </span>
          <p className="flex-1 pt-1.5 text-base font-medium leading-relaxed text-slate-800">{q.text}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {q.opts.map((opt) => {
          const checked = selected === opt.k;
          return (
            <label
              key={opt.k}
              className={`flex cursor-pointer select-none items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-all ${
                checked
                  ? 'border-edt-green bg-edt-green/5 text-edt-forest shadow-sm'
                  : 'border-slate-100 text-slate-700 hover:border-sky-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={q.id}
                value={opt.k}
                checked={checked}
                onChange={() => onSelect(opt.k)}
                className="sr-only"
              />
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold ${
                  checked ? 'border-edt-green bg-edt-green text-white' : 'border-slate-300 text-slate-400'
                }`}
              >
                {opt.k}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{opt.t}</span>
              {checked ? (
                <span className="flex-shrink-0 text-edt-green" aria-hidden="true">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}
