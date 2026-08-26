// Client-side PDF export, separate from window.print() — Print opens the OS print dialog
// (letting the user pick a printer or "Save as PDF" themselves); Download produces an actual
// .pdf file directly, no dialog involved. jspdf/html2canvas are dynamically imported so they
// never load until someone actually clicks Download.
export async function downloadElementAsPdf(elementId, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const node = document.getElementById(elementId);
  if (!node) throw new Error("Nothing to export");

  // Mirror the @media print override for bounded-scroll regions (e.g. a statement's running
  // ledger, see global.css's .scroll-box) — html2canvas has no concept of print media, so a
  // scrolled max-height box would otherwise only capture whatever's currently visible on
  // screen, silently truncating the document.
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
      backgroundColor: "#F5F7FA",
      // Print-only chrome (back link, Print/Download buttons, action buttons, forms, audit log)
      // is already marked .no-print for the browser's print stylesheet — reuse the same marker
      // here so the downloaded PDF matches what printing produces.
      ignoreElements: (el) => el.classList?.contains("no-print"),
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    // JPEG at high quality instead of PNG — these are flat, mostly-white business documents, so
    // PNG's lossless compression buys nothing but a ~10x larger file for the same page count.
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
