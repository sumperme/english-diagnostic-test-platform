import { EdtNavBar } from '../components/EdtNavBar';
import { ReportPdfActions } from '../components/ReportPdfActions';
import { getMessages } from '../i18n/messages';
import { formatDate } from '../lib/format';
import type { Session, Test2Result } from '../types';

const BAND_COLOR: Record<string, string> = {
  b1b2: 'bg-amber-100 text-amber-800 border-amber-300',
  c1: 'bg-sky-100 text-sky-800 border-sky-300',
  c2: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const PART_A = '01';
const PART_B = '02';

export function Test3ResultsScreen({
  result,
  session,
  onHome,
}: {
  result: Test2Result;
  session: Session;
  onHome: () => void;
}) {
  const t = getMessages('en');
  const variables = result.variables;

  if (!variables) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">
          {t.test2.processingSubmit}
        </div>
      </div>
    );
  }

  const duration = `${Math.floor(variables.attempt.durationSec / 60)}m ${variables.attempt.durationSec % 60}s`;
  const partScore = (partCode: string) => variables.scores.parts.find((part) => part.partCode === partCode);
  const partBand = (partCode: string) => variables.bands.parts.find((band) => band.partCode === partCode);
  const partA = partScore(PART_A);
  const partB = partScore(PART_B);
  const overall = variables.scores.overall;
  const pct = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 100) : 0);
  const overallBand = variables.bands.overall;
  const paper3 = t.test2.paper3Report;
  const overallNarrative = overallBand
    ? paper3.bandNarratives[overallBand.bandKey as keyof typeof paper3.bandNarratives]
    : undefined;
  const overallColor = overallBand
    ? (BAND_COLOR[overallBand.bandKey] ?? 'bg-slate-100 text-slate-700 border-slate-300')
    : '';

  const scoreCards = [
    {
      label: t.report.partA,
      sub: t.test2.partASpeaking,
      correct: partA?.correct ?? 0,
      total: partA?.total ?? 8,
      band: partBand(PART_A)?.cefrLabel,
    },
    {
      label: t.report.partB,
      sub: t.test2.partBWriting,
      correct: partB?.correct ?? 0,
      total: partB?.total ?? 2,
      band: partBand(PART_B)?.cefrLabel,
    },
    {
      label: t.report.final,
      sub: t.report.overallScore,
      correct: overall.correct,
      total: overall.total,
      band: overallBand?.cefrLabel,
      hi: true,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <EdtNavBar variant="app" onLogoClick={onHome} onBack={onHome} />

      <div className="-mt-nav bg-edt-forest px-4 pb-8 pt-nav text-white no-print">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-edt-neon">
            {variables.attempt.autoSubmitted ? t.report.autoSubmitted : t.report.submitted}
          </div>
          <h1 className="text-3xl font-extrabold">{t.report.title}</h1>
          <p className="mt-1 text-sm text-edt-soft/70">{paper3.reportSubtitle}</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-8">
        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-100 bg-white p-6">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">{t.report.candidateInfo}</h2>
            <div className="mb-4 inline-flex items-center rounded-full border border-edt-forest/20 bg-edt-forest/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-edt-forest">
              {t.report.userGroup}: {variables.candidate.userGroup}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                [t.report.name, variables.candidate.name],
                [t.report.candidateId, variables.candidate.ref],
                [t.report.date, formatDate(variables.attempt.endTime, 'en-GB')],
                [t.report.duration, duration],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="mb-0.5 text-xs font-medium text-slate-400">{label}</p>
                  <p className="break-words text-sm font-semibold text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {scoreCards.map((score) => (
              <div
                key={score.label}
                className={`rounded-2xl border p-5 text-center ${score.hi ? 'border-edt-forest bg-edt-forest text-edt-neon' : 'border-slate-100 bg-white'}`}
              >
                <p className={`mb-1 text-xs font-bold uppercase tracking-widest ${score.hi ? 'text-edt-neon' : 'text-slate-400'}`}>
                  {score.label}
                </p>
                <p className={`mb-0.5 text-3xl font-extrabold leading-none ${score.hi ? 'text-white' : 'text-slate-800'}`}>
                  {score.correct}
                  <span className="ml-0.5 text-base font-medium text-slate-400">/{score.total}</span>
                </p>
                <p className="text-sm font-semibold">{pct(score.correct, score.total)}%</p>
                <p className={`mt-1 text-xs ${score.hi ? 'text-edt-soft/70' : 'text-slate-400'}`}>
                  {score.sub}
                  {score.band ? ` · ${score.band}` : ''}
                </p>
              </div>
            ))}
          </section>

          {overallBand ? (
            <section className={`rounded-2xl border-2 p-6 ${overallColor}`}>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest opacity-70">{t.test2.overallBand}</p>
              <div className="mb-2 flex items-baseline gap-3">
                <span className="text-4xl font-extrabold">{overallBand.cefrLabel}</span>
              </div>
              {overallNarrative ? (
                <>
                  <p className="mb-2 text-sm font-semibold opacity-90">{overallNarrative.headline}</p>
                  <p className="text-sm leading-relaxed opacity-80">{overallNarrative.recommendation}</p>
                </>
              ) : null}
              <div className="mt-4 grid gap-3 border-t border-current/10 pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{t.report.approxIelts}</p>
                  <p className="text-sm font-semibold opacity-90">{overallBand.ielts ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{t.report.approxToefl}</p>
                  <p className="text-sm font-semibold opacity-90">{overallBand.toefl ?? '—'}</p>
                </div>
              </div>
              <p className="mt-3 text-xs italic leading-relaxed opacity-70">{t.report.proficiencyDisclaimer}</p>
            </section>
          ) : null}

          {variables.bands.parts.length > 0 ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-6">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">{t.test2.partBands}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {variables.bands.parts.map((band) => {
                  const label = band.partCode === PART_A ? paper3.partBandSpeaking : paper3.partBandWriting;
                  const score = partScore(band.partCode);
                  const narrative = paper3.bandNarratives[band.bandKey as keyof typeof paper3.bandNarratives];
                  return (
                    <div
                      key={band.partCode}
                      className={`rounded-xl border-2 p-4 ${BAND_COLOR[band.bandKey] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}
                    >
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold">{band.cefrLabel}</span>
                        {score ? (
                          <span className="text-sm font-semibold opacity-80">
                            {score.correct}/{score.total}
                          </span>
                        ) : null}
                      </div>
                      {narrative ? <p className="mb-2 text-xs leading-relaxed opacity-80">{narrative.headline}</p> : null}
                      <div className="mt-2 space-y-0.5 border-t border-current/10 pt-2 text-xs opacity-80">
                        {band.ielts ? (
                          <p>
                            {t.report.approxIelts}: <span className="font-semibold">{band.ielts}</span>
                          </p>
                        ) : null}
                        {band.toefl ? (
                          <p>
                            {t.report.approxToefl}: <span className="font-semibold">{band.toefl}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <ReportPdfActions
          attemptId={result.attemptId}
          sessionToken={session.sessionToken}
          voucherCode={session.voucherCode}
          endTime={variables.attempt.endTime}
          filename={`EDT-Report_${session.voucherCode ?? 'unknown'}_03_${result.attemptId}.pdf`}
        />
      </main>
    </div>
  );
}
