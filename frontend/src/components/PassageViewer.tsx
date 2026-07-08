import type { ClipboardEvent, MouseEvent } from 'react';
import { useLocale } from '../i18n/LocaleContext';

function blockCopyInteraction(event: ClipboardEvent | MouseEvent) {
  event.preventDefault();
}

/**
 * Reading passage in a fixed-height scrollable container. The parent keys this
 * component by resource id, so it only remounts (resetting scroll) when the
 * current question belongs to a different passage; consecutive questions on
 * the same passage keep the instance and the scroll position.
 */
export function PassageViewer({
  questionFrom,
  questionTo,
  content,
}: {
  questionFrom: number;
  questionTo: number;
  content: string;
}) {
  const { t } = useLocale();
  const header = t.test2.passageRangeHeader
    .replace('{from}', String(questionFrom))
    .replace('{to}', String(questionTo));

  return (
    <div
      className="select-none overflow-hidden rounded-2xl border-2 border-slate-200 bg-white"
      onCopy={blockCopyInteraction}
      onCut={blockCopyInteraction}
      onContextMenu={blockCopyInteraction}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-5 py-3">
        <p className="min-w-0 text-sm font-semibold leading-snug text-slate-700">{header}</p>
        <p className="text-xs text-slate-400">{t.test2.passageScrollHint}</p>
      </div>
      <div className="max-h-[38vh] overflow-y-auto px-5 py-4">
        <div className="rounded-xl border-2 border-edt-olive/30 bg-slate-50/50 px-4 py-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{content}</p>
        </div>
      </div>
    </div>
  );
}
