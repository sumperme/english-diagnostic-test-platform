export async function downloadReportPdf(element: HTMLElement, filename: string) {
  const html2pdf = (await import('html2pdf.js')).default;

  await html2pdf()
    .from(element)
    .set({
      margin: 10,
      filename,
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .save();
}
