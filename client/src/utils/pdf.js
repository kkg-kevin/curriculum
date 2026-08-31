// Client-side PDF export, separate from window.print() — Print opens the OS print dialog
// (letting the user pick a printer or "Save as PDF" themselves); Download produces an actual
// .pdf file directly, no dialog involved. jspdf/html2canvas are dynamically imported so they
// never load until someone actually clicks Download.
//
// Shared across modules (billing documents, learner reports, …). Mirrors the behavior of the
// browser's own print stylesheet: anything marked .no-print is dropped, and .scroll-box regions
// are un-clamped so a scrolled-out overflow isn't silently truncated in the capture.
export async function downloadElementAsPdf(elementId, filename, { backgroundColor = "#F5F7FA" } = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const node = document.getElementById(elementId);
  if (!node) throw new Error("Nothing to export");

  const restoreScrollBoxes = [...node.querySelectorAll(".scroll-box")].map((el) => {
    const prev = { maxHeight: el.style.maxHeight, overflow: el.style.overflow };
    el.style.maxHeight = "none";
    el.style.overflow = "visible";
    return () => { el.style.maxHeight = prev.maxHeight; el.style.overflow = prev.overflow; };
  });

  try {
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor,
      ignoreElements: (el) => el.classList?.contains("no-print"),
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    restoreScrollBoxes.forEach((fn) => fn());
  }
}
