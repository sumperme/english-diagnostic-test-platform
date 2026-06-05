const PDF_MARGIN_MM = 10;

async function loadPdfLibraries() {
  const [html2canvasModule, jspdfModule] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  const html2canvas = html2canvasModule.default;
  const jsPDF = jspdfModule.jsPDF ?? jspdfModule.default;
  return { html2canvas, jsPDF };
}

export async function downloadReportPdf(element: HTMLElement, filename: string) {
  const { html2canvas, jsPDF } = await loadPdfLibraries();

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#f8fafc',
    logging: false,
    onclone: (_document, clonedElement) => {
      if (clonedElement instanceof HTMLElement) {
        clonedElement.style.maxHeight = 'none';
        clonedElement.style.overflow = 'visible';
      }
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const printableWidth = pageWidth - PDF_MARGIN_MM * 2;
  const printableHeight = pageHeight - PDF_MARGIN_MM * 2;
  const imgHeight = (canvas.height * printableWidth) / canvas.width;

  let offset = 0;
  const pageCount = Math.ceil(imgHeight / printableHeight);

  for (let page = 0; page < pageCount; page++) {
    if (page > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', PDF_MARGIN_MM, PDF_MARGIN_MM - offset, printableWidth, imgHeight);
    offset += printableHeight;
  }

  pdf.save(filename);
}
