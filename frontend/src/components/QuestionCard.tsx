import type { ClipboardEvent, MouseEvent } from 'react';
import type { OptionKey, Question } from '../data/questions';

function blockCopyInteraction(event: ClipboardEvent | MouseEvent) {
  event.preventDefault();
}

export function QuestionCard({
  q,
  selected,
  onSelect,
  preventCopy = false,
}: {
  q: Question;
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

  return (
    <div
      {...copyGuardProps}
      className={`rounded-2xl border-2 bg-white p-6 transition-all ${selected ? 'border-sky-300 shadow-sm shadow-sky-100' : 'border-slate-100'} ${preventCopy ? 'select-none' : ''}`}
    >
      <p className={`mb-5 text-base font-medium leading-relaxed text-slate-800 ${preventCopy ? 'select-none' : ''}`}>
        <span className="mr-2 inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
          {q.canonicalNumber}
        </span>
        {q.text}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {q.opts.map((opt) => {
          const checked = selected === opt.k;
          return (
            <label
              key={opt.k}
              className={`flex cursor-pointer select-none items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${
                checked
                  ? 'border-sky-400 bg-sky-50 text-sky-800'
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
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                  checked ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 text-slate-400'
                }`}
              >
                {opt.k}
              </span>
              <span className="text-sm font-medium">{opt.t}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
