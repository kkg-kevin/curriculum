import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { BRAND_NAME, BRAND_LOGO } from "../../../branding";
import { certificateFields, formatCertificateDate, verifyUrl } from "../utils/certificate";

/* ──────────────────────────────────────────────────────────────────────────
 * The certificate itself — one landscape A4 sheet, drawn at a fixed size
 * (A4 at 96dpi) so it captures to PDF exactly as designed. Plain inline styles
 * and literal colours only: html2canvas reads those reliably.
 *
 * It says who, what they completed (a course, a pathway or a bootcamp), where,
 * when, and the number. Along the foot: the date, the signatory if the
 * workspace has set one (Settings → Certificates), and a QR to the public page
 * that confirms the certificate is genuine.
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

        <p style={{ margin: "26px 0 0", fontSize: 15, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: NAVY }}>
          Certificate of Completion
        </p>
        <div style={{ width: 84, height: 3, backgroundColor: GOLD, borderRadius: 2, marginTop: 14 }} />

        <p style={{ margin: "34px 0 0", fontSize: 16, color: INK_MUTED }}>This certifies that</p>
        <p style={{ margin: "10px 0 0", fontSize: 54, lineHeight: 1.1, fontWeight: 800, color: NAVY_DEEP, letterSpacing: "-0.01em", maxWidth: 900, overflowWrap: "anywhere" }}>
          {c.learnerName}
        </p>

        <p style={{ margin: "26px 0 0", fontSize: 16, color: INK_MUTED }}>has successfully completed {c.kindNoun}</p>
        <p style={{ margin: "10px 0 0", fontSize: 30, lineHeight: 1.2, fontWeight: 700, color: INK, maxWidth: 860, overflowWrap: "anywhere" }}>
          {c.title}
        </p>
        {c.hubName && <p style={{ margin: "12px 0 0", fontSize: 16, color: INK_MUTED }}>at {c.hubName}</p>}

        {/* foot: date · signatory · number and verification */}
        <div style={{ marginTop: "auto", width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, textAlign: "left" }}>
          <div style={{ width: 230 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>{formatCertificateDate(c.issuedAt)}</p>
            <div style={footRule} />
            <p style={footLabel}>Date awarded</p>
          </div>

          {c.signatory && <Signatory signatory={c.signatory} />}

          <div style={{ width: 230, display: "flex", alignItems: "flex-end", gap: 12, justifyContent: "flex-end" }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>{c.number}</p>
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
