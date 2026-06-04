import { FormEvent, useState } from 'react';
import { useLocale } from '../i18n/LocaleContext';
import type { CandidateInfo } from '../types';

export function InfoScreen({ onNext }: { onNext: (info: CandidateInfo) => void }) {
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [cid, setCid] = useState('');

  const go = (event: FormEvent) => {
    event.preventDefault();
    onNext({
      name: name.trim() || 'Anonymous Candidate',
      id: cid.trim() || 'N/A',
      testDate: Date.now(),
      mode: 'Online',
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-extrabold text-slate-800">{t.info.title}</h2>
          <p className="text-sm text-slate-500">{t.info.subtitle}</p>
        </div>
        <form onSubmit={go} className="space-y-5 rounded-2xl border border-slate-100 bg-white p-7 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t.info.name}</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. CHAN TAI MAN JACKIE"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-slate-800 outline-none transition-colors focus:border-sky-400"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {t.info.id} <span className="text-xs font-normal text-slate-400">({t.info.optional})</span>
            </label>
            <input
              type="text"
              value={cid}
              onChange={(event) => setCid(event.target.value)}
              placeholder="e.g. A28330124"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-slate-800 outline-none transition-colors focus:border-sky-400"
            />
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="mt-0.5 text-amber-500">!</span>
            <p className="text-xs leading-relaxed text-amber-700">{t.info.warning}</p>
          </div>
          <button type="submit" className="w-full rounded-xl bg-sky-500 py-3.5 text-base font-bold text-white transition-colors hover:bg-sky-600">
            {t.info.start}
          </button>
        </form>
      </div>
    </div>
  );
}
