import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { BRAND_NAME, BRAND_LOGO } from "../../../branding";
import { certificateFields, certificateWording, fitSize, formatCertificateDate, verifyUrl } from "../utils/certificate";

/* ──────────────────────────────────────────────────────────────────────────
 * The certificate itself — one landscape A4 sheet, drawn at a fixed size
 * (A4 at 96dpi) so it captures to PDF exactly as designed. Plain inline styles
 * and literal colours only: html2canvas reads those reliably.
 *
 * It says who and what they completed (20 Nov 2026 layout): the heading names
 * the kind ("Module Certificate"); the course is always the large title — a
 * module certificate leads "has successfully completed Module 2 of" and puts
 * "Module 2 of 3 · <module name>" under it; a course certificate lists its
 * modules as ticked chips (certificateWording in utils/certificate.js). Long
 * names step down in size. Along the foot: the date, the signatory if the
 * workspace has set one (Settings → Certificates), and the number, the
 * learning hub and a QR to the public page that confirms it is genuine.
 *
 * Callers never show this at full size on a narrow screen; CertificateViewer
 * scales it to fit.
 * ────────────────────────────────────────────────────────────────────────── */

export const CERT_WIDTH = 1123;
export const CERT_HEIGHT = 794;

const NAVY = "#25476a";
const NAVY_DEEP = "#1a3550";
const GOLD = "#feb139";
const INK = "#111827";
const INK_MUTED = "#6B7280";
const PAPER = "#FFFDF8";

const corner = (pos) => ({
  position: "absolute", width: 64, height: 64, borderColor: GOLD, borderStyle: "solid", borderWidth: 0, ...pos,
});
// [up to this many characters, font size] — long names step down so they stay on the sheet.
const NAME_SIZES = [[24, 54], [32, 46], [44, 38], [Infinity, 32]];
const TITLE_SIZES = [[30, 34], [48, 28], [70, 23], [Infinity, 20]];
const MAX_MODULE_CHIPS = 8;

const footLabel = { margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: INK_MUTED };
const footRule = { height: 1, backgroundColor: NAVY, margin: "8px 0 6px" };

// The signature above the signatory's name. An image that fails to load (a removed upload) just
// leaves the name and title — never a broken-image icon on a certificate.
function Signatory({ signatory }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ minWidth: 240, maxWidth: 300, textAlign: "center" }}>
      <div style={{ height: 58, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {signatory.image && !failed && (
          <img src={signatory.image} alt="" crossOrigin="anonymous" onError={() => setFailed(true)} style={{ maxHeight: 58, maxWidth: 220, objectFit: "contain" }} />
        )}
      </div>
      <div style={footRule} />
      {signatory.name && <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>{signatory.name}</p>}
      {signatory.title && <p style={{ ...footLabel, marginTop: 3 }}>{signatory.title}</p>}
    </div>
  );
}

export default function CertificateDocument({ certificate, id }) {
  const c = certificateFields(certificate);
  const url = verifyUrl(c.verifyToken);
  const words = certificateWording(c);
  // A course certificate lists its modules as ticked chips — at most two rows' worth.
  const shownModules = words.modules.slice(0, MAX_MODULE_CHIPS);
  const hiddenModules = words.modules.length - shownModules.length;

  return (
    <div
      id={id}
      style={{
        position: "relative", width: CERT_WIDTH, height: CERT_HEIGHT, boxSizing: "border-box",
        backgroundColor: PAPER, fontFamily: "Inter, Helvetica, Arial, sans-serif", color: INK, overflow: "hidden",
      }}
    >
      {/* frame */}
      <div style={{ position: "absolute", top: 22, right: 22, bottom: 22, left: 22, border: `3px solid ${NAVY}`, borderRadius: 6 }} />
      <div style={{ position: "absolute", top: 32, right: 32, bottom: 32, left: 32, border: `1px solid ${GOLD}`, borderRadius: 3 }} />
      <div style={corner({ top: 44, left: 44, borderTopWidth: 4, borderLeftWidth: 4 })} />
      <div style={corner({ top: 44, right: 44, borderTopWidth: 4, borderRightWidth: 4 })} />
      <div style={corner({ bottom: 44, left: 44, borderBottomWidth: 4, borderLeftWidth: 4 })} />
      <div style={corner({ bottom: 44, right: 44, borderBottomWidth: 4, borderRightWidth: 4 })} />

      <div style={{ position: "absolute", top: 70, right: 90, bottom: 60, left: 90, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <img src={BRAND_LOGO} alt={BRAND_NAME} crossOrigin="anonymous" style={{ height: 54, objectFit: "contain" }} />

        <p style={{ margin: "24px 0 0", fontSize: 15, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: NAVY }}>
          {c.heading}
        </p>
        <div style={{ width: 84, height: 3, backgroundColor: GOLD, borderRadius: 2, marginTop: 14 }} />

        {/* who and what, centred in the space between the heading and the foot */}
        <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 16, color: INK_MUTED }}>This certifies that</p>
        <p style={{ margin: "10px 0 0", fontSize: fitSize(c.learnerName, NAME_SIZES), lineHeight: 1.1, fontWeight: 800, color: NAVY_DEEP, letterSpacing: "-0.01em", maxWidth: 900, overflowWrap: "anywhere" }}>
          {c.learnerName}
        </p>

        <p style={{ margin: "24px 0 0", fontSize: 16, color: INK_MUTED }}>{words.lead}</p>
        <p style={{ margin: "10px 0 0", fontSize: fitSize(words.title, TITLE_SIZES), lineHeight: 1.2, fontWeight: 800, color: INK, letterSpacing: "0.01em", maxWidth: 860, overflowWrap: "anywhere" }}>
          {words.title}
        </p>
        {words.detail && (
          <p style={{ margin: "10px 0 0", fontSize: 17, fontWeight: 600, color: NAVY, maxWidth: 820, overflowWrap: "anywhere" }}>{words.detail}</p>
        )}
        {shownModules.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, maxWidth: 860 }}>
            {shownModules.map((name, i) => (
              <span key={`${i}-${name}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, border: `1px solid ${GOLD}`, backgroundColor: "#FFF7E6", fontSize: 12.5, fontWeight: 600, color: NAVY_DEEP, maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ display: "inline-block", flexShrink: 0, width: 4, height: 8, marginTop: -2, borderRight: "2px solid #059669", borderBottom: "2px solid #059669", transform: "rotate(45deg)" }} />
                {name}
              </span>
            ))}
            {hiddenModules > 0 && (
              <span style={{ padding: "5px 12px", borderRadius: 999, border: `1px solid ${GOLD}`, fontSize: 12.5, fontWeight: 600, color: INK_MUTED }}>
                + {hiddenModules} more
              </span>
            )}
          </div>
        )}
        </div>

        {/* foot: date · signatory · number, hub and verification */}
        <div style={{ width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, textAlign: "left" }}>
          <div style={{ width: 230 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>{formatCertificateDate(c.issuedAt)}</p>
            <div style={footRule} />
            <p style={footLabel}>Date awarded</p>
          </div>

          {c.signatory && <Signatory signatory={c.signatory} />}

          <div style={{ width: 230, display: "flex", alignItems: "flex-end", gap: 12, justifyContent: "flex-end" }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>{c.number}</p>
              {c.hubName && (
                <p style={{ margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.35, color: INK }}>
                  <span style={{ color: INK_MUTED }}>Learning hub:</span> <strong>{c.hubName}</strong>
                </p>
              )}
              <p style={{ margin: "4px 0 0", fontSize: 10.5, lineHeight: 1.45, color: INK_MUTED }}>
                Scan to confirm this<br />certificate is genuine
              </p>
            </div>
            {url && <QRCodeCanvas value={url} size={84} marginSize={0} fgColor={NAVY_DEEP} bgColor={PAPER} />}
          </div>
        </div>
      </div>
    </div>
  );
}
