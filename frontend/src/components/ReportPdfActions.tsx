import { useState } from 'react';
import { REPORT_MESSAGES } from '../i18n/reportMessages';
import { ApiError, downloadServerReportPdf } from '../lib/api';
import { AiFeedbackSection } from './AiFeedbackSection';

/** Matches worker/src/reports.ts PDF_TTL_MS. */
const PDF_TTL_MS = 24 * 60 * 60 * 1000;

function pdfHasExpired(endTime: number | undefined): boolean {
  return typeof endTime === 'number' && endTime > 0 && Date.now() > endTime + PDF_TTL_MS;
}

export function ReportPdfActions({
  attemptId,
  sessionToken,
  voucherCode,
  endTime,
  filename,
}: {
  attemptId: string;
  sessionToken: string;
  voucherCode?: string;
  endTime?: number;
  filename: string;
}) {
  const expired = pdfHasExpired(endTime);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(expired ? REPORT_MESSAGES.pdfExpired : null);

  const exportPdf = async () => {
    if (pdfHasExpired(endTime)) {
      setMessage(REPORT_MESSAGES.pdfExpired);
      return;
    }
    setIsExporting(true);
    setMessage(null);
    try {
      await downloadServerReportPdf(attemptId, sessionToken, filename, undefined, voucherCode);
    } catch (error) {
      const expiredNow = error instanceof ApiError && error.code === 'REPORT_EXPIRED';
      setMessage(expiredNow ? REPORT_MESSAGES.pdfExpired : REPORT_MESSAGES.pdfError);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="pb-4 pt-4 no-print">
      {message ? <p className="mb-3 text-center text-sm text-rose-600">{message}</p> : null}
      <AiFeedbackSection
        attemptId={attemptId}
        sessionToken={sessionToken}
        downloadButton={
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={isExporting || expired}
            className="inline-flex items-center gap-2 rounded-xl bg-edt-forest px-6 py-3 text-sm font-semibold text-edt-neon transition-colors hover:bg-[#243b37] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? REPORT_MESSAGES.downloading : REPORT_MESSAGES.downloadPdf}
          </button>
        }
      />
    </div>
  );
}
