import { useRef } from "react";
import { FiDownload, FiPrinter } from "react-icons/fi";
import { QRCodeCanvas } from "qrcode.react";
import { BRAND_NAME } from "../../../branding";

const ACCENT = "#25476a";

const actionStyle = {
  display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", backgroundColor: "#e8f5fb", color: ACCENT,
  border: "1.5px solid #a8d5ee", borderRadius: 7, fontSize: 11, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// Printed from a throwaway hidden iframe rather than a new window (pop-up blockers) or the page
// itself (which would print the whole portal around the badge).
function printBadge({ dataUrl, name, registrationNumber }) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)} — profile QR</title><style>
    @page { margin: 12mm; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: #111827; }
    .badge { width: 74mm; margin: 0 auto; padding: 7mm 6mm; border: 0.4mm solid #25476a; border-radius: 4mm; text-align: center; }
    .brand { font-size: 9pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #25476a; }
    .name { margin: 3mm 0 1mm; font-size: 15pt; font-weight: 800; }
    .reg { font-size: 9pt; color: #6B7280; }
    img { width: 52mm; height: 52mm; margin: 4mm 0 3mm; }
    .hint { font-size: 8pt; color: #6B7280; }
  </style></head><body><div class="badge">
    <div class="brand">${escapeHtml(BRAND_NAME)}</div>
    <div class="name">${escapeHtml(name)}</div>
    ${registrationNumber ? `<div class="reg">${escapeHtml(registrationNumber)}</div>` : ""}
    <img src="${dataUrl}" alt="Profile QR code" />
    <div class="hint">Scan to view this learner's profile</div>
  </div></body></html>`);
  doc.close();
  const img = doc.querySelector("img");
  const print = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
  if (img.complete) print();
  else img.onload = print;
}

// Saving or printing a Share Profile card's QR code. Shared by the admin/school card
// (LearnerViewPage) and the learner portal's own (ShareProfileCard), which each keep their own
// surrounding layout.
export default function ShareQrTools({ learner, publicUrl }) {
  const canvasRef = useRef(null);
  const name = `${learner?.firstName || ""} ${learner?.lastName || ""}`.trim() || "Learner";

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = canvasRef.current.toDataURL("image/png");
    link.download = `${name.replace(/[^a-z0-9]+/gi, "-")}-profile-qr.png`;
    link.click();
  };

  const handlePrint = () => {
    printBadge({ dataUrl: canvasRef.current.toDataURL("image/png"), name, registrationNumber: learner?.registrationNumber });
  };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {/* Print-resolution copy of the on-screen code — the visible one is only 84px. */}
      <QRCodeCanvas ref={canvasRef} value={publicUrl} size={720} marginSize={2} style={{ display: "none" }} />
      <button type="button" onClick={handleDownload} style={actionStyle}><FiDownload size={12} /> Download QR</button>
      <button type="button" onClick={handlePrint} style={actionStyle}><FiPrinter size={12} /> Print badge</button>
    </div>
  );
}
