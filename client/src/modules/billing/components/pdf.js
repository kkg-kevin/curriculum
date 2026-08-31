import digifunziLogoUrl from "../../../assets/Logo-image.png";

/* ──────────────────────────────────────────────────────────────────────────
 * Billing document PDFs — drawn natively with jsPDF + jspdf-autotable rather
 * than screenshotting the page. That gives a real document: selectable /
 * searchable text, crisp at any zoom, ~50KB, and table page-breaks that never
 * cut a row. The on-screen page stays a preview; only Download changes.
 *
 * jspdf / jspdf-autotable are dynamically imported so nothing loads until a
 * user actually clicks Download.
 * ────────────────────────────────────────────────────────────────────────── */

const NAVY = [37, 71, 106];      // #25476a
const NAVY_DEEP = [20, 47, 74];  // #142F4A
const INK = [17, 24, 39];        // #111827
const MUTED = [107, 114, 128];   // #6B7280
const FAINT = [156, 163, 175];   // #9CA3AF
const LINE = [230, 232, 236];    // #E6E8EC
const GOOD = [4, 120, 87];       // #047857
const WARN = [194, 65, 12];      // #C2410C

const MARGIN = 44;
const PAGE_W = 595.28; // A4 pt
const CONTENT_W = PAGE_W - MARGIN * 2;

function money(amount, currency = "KES") {
  return `${currency} ${Number(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(value, fallback = "—") {
  return value ? new Date(value).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : fallback;
}
function safeFilePart(s) {
  return String(s || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
function formatAddress(address) {
  if (!address) return null;
  if (typeof address === "string") return address;
  return [address.street, address.city, address.county].filter(Boolean).join(", ") || null;
}

/* Load an image URL → { dataUrl, width, height, format } for jsPDF.addImage,
 * downscaled so the PDF stays small (jsPDF embeds the raster as-is — a 2000px
 * source photo would balloon the file to megabytes). `maxPx` caps the longer
 * edge; `format` is PNG for logos (crisp edges, transparency) and JPEG for
 * photos (much smaller). `crossOrigin` so a same-origin-CORS /uploads image
 * can be canvas-read; any failure (CORS-tainted external URL, 404, offline)
 * resolves to null and the caller just omits the image. */
function loadImage(url, { maxPx = 220, format = "PNG", circle = false } = {}) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (circle) {
          // Square, centre-cropped, circular mask — a round avatar with a transparent
          // corner, matching how the app renders learner/hub photos.
          const side = Math.min(maxPx, Math.min(img.naturalWidth, img.naturalHeight));
          canvas.width = side;
          canvas.height = side;
          ctx.beginPath();
          ctx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          const srcSide = Math.min(img.naturalWidth, img.naturalHeight);
          ctx.drawImage(img, (img.naturalWidth - srcSide) / 2, (img.naturalHeight - srcSide) / 2, srcSide, srcSide, 0, 0, side, side);
          resolve({ dataUrl: canvas.toDataURL("image/png"), width: side, height: side, format: "PNG" });
          return;
        }
        const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.width = w;
        canvas.height = h;
        if (format === "JPEG") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = format === "JPEG" ? canvas.toDataURL("image/jpeg", 0.82) : canvas.toDataURL("image/png");
        resolve({ dataUrl, width: w, height: h, format });
      } catch {
        resolve(null); // tainted canvas
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadDocImages(doc) {
  const [digifunzi, hubLogo, learnerPhoto] = await Promise.all([
    loadImage(digifunziLogoUrl, { maxPx: 240, format: "PNG" }),
    loadImage(doc.issuedBy?.logo, { maxPx: 120, format: "PNG" }),
    loadImage(doc.learner?.photo, { maxPx: 96, circle: true }),
  ]);
  return { digifunzi, hubLogo, learnerPhoto };
}

/* ── Shared drawing helpers ───────────────────────────────────────────── */

// Top brand band: Digifunzi wordmark (always) + hub logo/name (right) + the
// document kind/number. Returns the y-cursor below the band.
function drawHeader(pdf, { images, kind, number, statusLabel }) {
  const bandH = 96;
  pdf.setFillColor(...NAVY_DEEP);
  pdf.rect(0, 0, PAGE_W, bandH, "F");

  // Digifunzi wordmark, inverted to white
  if (images.digifunzi) {
    const h = 20;
    const w = (images.digifunzi.width / images.digifunzi.height) * h;
    // draw white behind via a filter isn't available; the asset is dark, so
    // place it on a subtle rounded chip for contrast
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(MARGIN - 6, 24 - 6, w + 12, h + 12, 4, 4, "F");
    pdf.addImage(images.digifunzi.dataUrl, "PNG", MARGIN, 24, w, h);
  } else {
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text("Digifunzi", MARGIN, 40);
  }

  // Right: hub logo on a white chip (its own colours over the navy band)
  if (images.hubLogo) {
    const s = 30;
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(PAGE_W - MARGIN - s - 8, 20, s + 8, s + 8, 5, 5, "F");
    pdf.addImage(images.hubLogo.dataUrl, images.hubLogo.format, PAGE_W - MARGIN - s - 4, 24, s, s);
  }

  // Document kind + number
  pdf.setTextColor(155, 215, 242); // #9BD7F2
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(kind.toUpperCase(), MARGIN, 66);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(17);
  pdf.text(number || "", MARGIN, 84);

  // Status chip (draft / cancelled / paid) — outlined, bottom-right of the band
  if (statusLabel) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    const txt = statusLabel.toUpperCase();
    const tw = pdf.getTextWidth(txt);
    pdf.setDrawColor(255, 255, 255);
    pdf.roundedRect(PAGE_W - MARGIN - tw - 16, 60, tw + 16, 16, 8, 8, "S");
    pdf.text(txt, PAGE_W - MARGIN - tw - 8, 71);
  }

  return bandH + 24;
}

// Two-column party block: "Issued by" (left) and a right-hand block (Bill to /
// Received from / Statement for). Returns the y-cursor below the taller column.
function drawParties(pdf, y, { issuedBy, rightLabel, rightParty, learner, images }) {
  const colW = (CONTENT_W - 24) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + 24;

  const label = (x, text) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...FAINT);
    pdf.text(text.toUpperCase(), x, y);
  };
  const lines = (x, startY, party) => {
    let ly = startY;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...INK);
    pdf.text(party?.name || "Not provided", x, ly);
    ly += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    for (const bit of [party?.email, party?.phone, formatAddress(party?.address)].filter(Boolean)) {
      pdf.text(String(bit), x, ly);
      ly += 12;
    }
    return ly;
  };

  label(leftX, "Issued by");
  label(rightX, rightLabel);
  const leftEnd = lines(leftX, y + 14, issuedBy);
  let rightEnd = lines(rightX, y + 14, rightParty);

  // Learner line under the right party, when the document concerns one
  if (learner) {
    rightEnd += 4;
    const name = `${learner.firstName || ""} ${learner.lastName || ""}`.trim();
    if (images.learnerPhoto) {
      const s = 16;
      pdf.addImage(images.learnerPhoto.dataUrl, images.learnerPhoto.format, rightX, rightEnd - 11, s, s);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...MUTED);
      pdf.text(`Learner: ${name}`, rightX + s + 6, rightEnd);
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...MUTED);
      pdf.text(`Learner: ${name}`, rightX, rightEnd);
    }
    rightEnd += 12;
  }

  return Math.max(leftEnd, rightEnd) + 18;
}

// Key/value meta grid (Created / Due date / Period / Currency …).
function drawMeta(pdf, y, entries) {
  const perRow = 3;
  const colW = CONTENT_W / perRow;
  let row = 0;
  entries.forEach((e, i) => {
    const col = i % perRow;
    if (col === 0 && i > 0) row += 1;
    const x = MARGIN + col * colW;
    const cy = y + row * 34;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...FAINT);
    pdf.text(e.label.toUpperCase(), x, cy);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK);
    pdf.text(String(e.value ?? "—"), x, cy + 12);
  });
  return y + (row + 1) * 34 + 8;
}

// Footer on every page: rule, terms line, "Generated" + page N of M.
function drawFooters(pdf, termsLine) {
  const total = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    const h = pdf.internal.pageSize.getHeight();
    pdf.setDrawColor(...LINE);
    pdf.line(MARGIN, h - 42, PAGE_W - MARGIN, h - 42);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...FAINT);
    if (termsLine) pdf.text(termsLine, MARGIN, h - 28, { maxWidth: CONTENT_W - 120 });
    pdf.text(`Generated ${fmtDate(new Date().toISOString())}`, MARGIN, h - 16);
    pdf.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, h - 16, { align: "right" });
  }
}

async function newDoc() {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.default || autoTableMod.autoTable;
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  return { pdf, autoTable, jsPDF };
}

/* ── Invoice ──────────────────────────────────────────────────────────── */

export async function buildInvoicePdf(invoice) {
  const { pdf, autoTable } = await newDoc();
  const images = await loadDocImages(invoice);
  const currency = invoice.currency || "KES";
  const statusLabel = ["draft", "cancelled"].includes(invoice.status) ? invoice.status : null;

  pdf.setProperties({
    title: `Invoice ${invoice.invoiceNumber}`,
    subject: "Invoice",
    author: invoice.issuedBy?.name || "Digifunzi",
    creator: "Digifunzi Billing",
  });

  let y = drawHeader(pdf, { images, kind: "Invoice", number: invoice.invoiceNumber, statusLabel });
  y = drawParties(pdf, y, {
    issuedBy: invoice.issuedBy,
    rightLabel: "Bill to",
    rightParty: invoice.billTo,
    learner: invoice.learner,
    images,
  });

  y = drawMeta(pdf, y, [
    { label: "Invoice type", value: (invoice.invoiceType || "").replace(/_/g, " ") },
    { label: "Issued", value: fmtDate(invoice.issuedAt, "Not issued") },
    { label: "Due date", value: fmtDate(invoice.dueAt, "No due date") },
    { label: "Billing period", value: invoice.periodLabel || "—" },
    { label: "Currency", value: currency },
    ...(invoice.pricingMode === "per_learner"
      ? [{ label: "Basis", value: `${money(invoice.unitAmount, currency)} / learner · ${invoice.learnerCount} learners` }]
      : []),
  ]);

  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Description", "Qty", "Unit amount", "Amount"]],
    body: (invoice.items || []).map((it) => [
      it.description || "",
      String(it.quantity ?? ""),
      money(it.unitAmount, currency),
      money(it.totalAmount, currency),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 7, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
    headStyles: { fillColor: [248, 250, 252], textColor: FAINT, fontStyle: "bold", fontSize: 7.5, halign: "left" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold", textColor: NAVY } },
    theme: "grid",
  });

  // Totals box, right-aligned
  let ty = pdf.lastAutoTable.finalY + 16;
  const boxX = PAGE_W - MARGIN - 200;
  const rows = [
    ["Subtotal", money(invoice.subtotal, currency), MUTED],
    ["Discount", `- ${money(invoice.discount, currency)}`, MUTED],
    ["Total", money(invoice.total, currency), NAVY],
    ["Amount due", money(invoice.amountDue, currency), invoice.amountDue > 0 ? WARN : GOOD],
  ];
  rows.forEach(([label, val, color], i) => {
    const bold = i >= 2;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(bold ? 11 : 9);
    pdf.setTextColor(...color);
    if (i === 2) { pdf.setDrawColor(...LINE); pdf.line(boxX, ty - 6, PAGE_W - MARGIN, ty - 6); }
    pdf.text(label, boxX, ty);
    pdf.text(val, PAGE_W - MARGIN, ty, { align: "right" });
    ty += bold ? 18 : 14;
  });

  if (invoice.notes) {
    ty += 12;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...FAINT);
    pdf.text("NOTES", MARGIN, ty);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text(pdf.splitTextToSize(invoice.notes, CONTENT_W), MARGIN, ty + 12);
  }

  drawFooters(pdf, "This invoice was generated by Digifunzi. Please quote the invoice number on payment.");
  pdf.save(`invoice-${safeFilePart(invoice.invoiceNumber)}${invoice.billTo?.name ? "-" + safeFilePart(invoice.billTo.name) : ""}.pdf`);
}

/* ── Receipt ──────────────────────────────────────────────────────────── */

export async function buildReceiptPdf(receipt) {
  const { pdf } = await newDoc();
  const images = await loadDocImages(receipt);
  const currency = receipt.invoice?.currency || "KES";

  pdf.setProperties({
    title: `Receipt ${receipt.receiptNumber}`,
    subject: "Payment receipt",
    author: receipt.issuedBy?.name || "Digifunzi",
    creator: "Digifunzi Billing",
  });

  let y = drawHeader(pdf, { images, kind: "Payment receipt", number: receipt.receiptNumber, statusLabel: "Paid" });
  y = drawParties(pdf, y, {
    issuedBy: receipt.issuedBy,
    rightLabel: "Received from",
    rightParty: receipt.billTo,
    learner: receipt.learner,
    images,
  });

  // Amount received — large, centered
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...FAINT);
  pdf.text("AMOUNT RECEIVED", PAGE_W / 2, y, { align: "center" });
  pdf.setFontSize(28);
  pdf.setTextColor(...GOOD);
  pdf.text(money(receipt.amount, currency), PAGE_W / 2, y + 28, { align: "center" });
  y += 52;

  pdf.setDrawColor(...LINE);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 18;

  y = drawMeta(pdf, y, [
    { label: "Payment method", value: (receipt.paymentMethod || receipt.provider || "").replace(/_/g, " ") },
    { label: "Date received", value: fmtDate(receipt.paidAt) },
    { label: "Reference", value: receipt.providerReference || "Not provided" },
    { label: "Applied to invoice", value: receipt.invoice?.invoiceNumber || "—" },
    { label: "Invoice total", value: money(receipt.invoice?.total, currency) },
  ]);

  if (receipt.notes) {
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...FAINT);
    pdf.text("NOTES", MARGIN, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text(pdf.splitTextToSize(receipt.notes, CONTENT_W), MARGIN, y + 12);
  }

  drawFooters(pdf, "This receipt is auto-generated and confirms payment was received against the invoice above.");
  pdf.save(`receipt-${safeFilePart(receipt.receiptNumber)}.pdf`);
}

/* ── Statement of account ─────────────────────────────────────────────── */

export async function buildStatementPdf(statement) {
  const { pdf, autoTable } = await newDoc();
  const images = await loadDocImages(statement);
  const currency = "KES";
  const name = statement.billTo?.name || "account";

  pdf.setProperties({
    title: `Statement — ${name}`,
    subject: "Statement of account",
    author: statement.issuedBy?.name || "Digifunzi",
    creator: "Digifunzi Billing",
  });

  let y = drawHeader(pdf, { images, kind: "Statement of account", number: `${fmtDate(statement.from)} – ${fmtDate(statement.to)}` });
  y = drawParties(pdf, y, {
    issuedBy: statement.issuedBy,
    rightLabel: "Statement for",
    rightParty: statement.billTo,
    learner: statement.learner,
    images,
  });

  // Summary tiles
  const tiles = [
    ["Opening balance", statement.openingBalance, NAVY],
    ["Total invoiced", statement.totalInvoiced, [29, 78, 216]],
    ["Total paid", statement.totalPaid, GOOD],
    ["Closing balance", statement.closingBalance, statement.closingBalance > 0 ? WARN : GOOD],
  ];
  const tileW = (CONTENT_W - 3 * 10) / 4;
  tiles.forEach(([label, val, color], i) => {
    const x = MARGIN + i * (tileW + 10);
    pdf.setDrawColor(...LINE);
    pdf.roundedRect(x, y, tileW, 44, 4, 4, "S");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...color);
    pdf.text(money(val, currency), x + 8, y + 20);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(label, x + 8, y + 34);
  });
  y += 44 + 20;

  // Ledger
  const body = [
    [{ content: "Opening balance", colSpan: 5, styles: { fontStyle: "italic", textColor: MUTED } }, { content: money(statement.openingBalance, currency), styles: { halign: "right", fontStyle: "bold" } }],
    ...(statement.ledger || []).map((l) => [
      fmtDate(l.date),
      l.reference || "",
      (l.description || "").replace(/_/g, " "),
      l.debit > 0 ? money(l.debit, currency) : "",
      l.credit > 0 ? money(l.credit, currency) : "",
      money(l.balance, currency),
    ]),
  ];
  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Date", "Reference", "Description", "Debit", "Credit", "Balance"]],
    body,
    foot: [[{ content: "Closing balance", colSpan: 5, styles: { fontStyle: "bold" } }, { content: money(statement.closingBalance, currency), styles: { halign: "right", fontStyle: "bold", textColor: NAVY } }]],
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 6, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
    headStyles: { fillColor: [248, 250, 252], textColor: FAINT, fontStyle: "bold", fontSize: 7 },
    footStyles: { fillColor: [255, 255, 255], textColor: INK, lineColor: LINE, lineWidth: 0.5 },
    columnStyles: { 3: { halign: "right", textColor: WARN }, 4: { halign: "right", textColor: GOOD }, 5: { halign: "right", fontStyle: "bold", textColor: NAVY } },
    theme: "grid",
    didParseCell: (d) => { if (d.section === "body" && Array.isArray(d.row.raw) && d.row.raw[0]?.content) d.cell.styles.fillColor = [250, 251, 255]; },
  });

  // Aging summary
  let ay = pdf.lastAutoTable.finalY + 18;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...INK);
  pdf.text("Aging summary", MARGIN, ay);
  ay += 10;
  const AGE_LABELS = { current: "Current", "1-30": "1–30 days", "31-60": "31–60 days", "61-90": "61–90 days", "90+": "90+ days" };
  const buckets = Object.entries(statement.aging || {});
  const bw = (CONTENT_W - (buckets.length - 1) * 10) / buckets.length;
  buckets.forEach(([bucket, amount], i) => {
    const x = MARGIN + i * (bw + 10);
    pdf.setDrawColor(...LINE);
    pdf.roundedRect(x, ay, bw, 40, 4, 4, "S");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...(Number(amount) > 0 && bucket !== "current" ? [185, 28, 28] : NAVY));
    pdf.text(money(amount, currency), x + 7, ay + 18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(AGE_LABELS[bucket] || bucket, x + 7, ay + 31);
  });

  drawFooters(pdf, "A running ledger of every invoice and payment for this payer over the period shown.");
  pdf.save(`statement-${safeFilePart(name)}-${safeFilePart(fmtDate(statement.to))}.pdf`);
}

/* ── Legacy html2canvas fallback ──────────────────────────────────────────
 * Kept for any caller still passing an element id (and as a safety net if a
 * builder ever throws) — unchanged behaviour, just no longer the primary path. */
export async function downloadElementAsPdf(elementId, filename) {
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
      scale: 2, useCORS: true, backgroundColor: "#F5F7FA",
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
