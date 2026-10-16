import { useState } from 'react';
import { AiFeedbackSection } from '../components/AiFeedbackSection';
import { EdtNavBar } from '../components/EdtNavBar';
import {
  Paper1Concluding,
  Paper1GrowthRoadmap,
  Paper1MasteryProfile,
  Paper1Strengths,
  Paper1Summary,
  Paper1Vocabulary,
  ReportBand,
} from '../components/Paper1Report';
import { getMessages } from '../i18n/messages';
import { downloadServerReportPdf } from '../lib/api';
import type { Session, Test2Result } from '../types';

/** Paper I report (rv3): section order follows the Oct 2026 sample report. */
export function ResultsScreen({
  result,
  session,
  onHome,
}: {
  result: Test2Result;
  session: Session;
  onHome: () => void;
}) {
  const t = getMessages('en');
  const p = t.report.paper1;
  const [isExporting, setIsExporting] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const variables = result.variables;
  const report = variables?.paper1;
  const feedback = result.feedback ?? {};

  if (!variables || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">
          {t.test2.startError}
        </div>
      </div>
    );
  }

  const exportPdf = async () => {
    setIsExporting(true);
    setPdfError(false);
    try {
      const voucher = session.voucherCode ?? 'unknown';
      await downloadServerReportPdf(result.attemptId, session.sessionToken, `EDT-Report_${voucher}_01_${result.attemptId}.pdf`);
    } catch {
      setPdfError(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <EdtNavBar variant="app" onLogoClick={onHome} onBack={onHome} />

      <div className="-mt-nav bg-edt-forest px-4 pb-8 pt-nav text-white no-print">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-edt-neon">
            {variables.attempt.autoSubmitted ? t.report.autoSubmitted : t.report.submitted}
          </div>
          <h1 className="text-3xl font-semibold">{p.reportTitle}</h1>
          <p className="mt-1 text-sm text-edt-soft/70">{p.subtitle}</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-8">
        <Paper1Summary variables={variables} report={report} />

        <ReportBand>{p.partATitle}</ReportBand>
        <Paper1MasteryProfile report={report} />

        <ReportBand>{p.evaluationTitle}</ReportBand>
        <Paper1Strengths report={report} feedback={feedback} />
        <Paper1GrowthRoadmap report={report} feedback={feedback} />
        <Paper1Concluding report={report} feedback={feedback} />

        <ReportBand>{p.partBTitle}</ReportBand>
        <Paper1Vocabulary report={report} feedback={feedback} />

        <div className="pb-4 pt-4 no-print">
          {pdfError ? <p className="mb-3 text-center text-sm text-rose-600">{t.test2.pdfError}</p> : null}
          <AiFeedbackSection
            attemptId={result.attemptId}
            sessionToken={session.sessionToken}
            downloadButton={
              <button
                onClick={() => void exportPdf()}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-xl bg-edt-forest px-6 py-3 text-sm font-semibold text-edt-neon transition-colors hover:bg-[#243b37] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isExporting ? t.report.downloading : t.report.downloadPdf}
              </button>
            }
          />
        </div>
      </main>
    </div>
  );
}
