import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { BRAND_NAME, BRAND_LOGO } from "../../../branding";
import { certificateFields, certificateWording, fitSize, formatCertificateDate, verifyUrl } from "../utils/certificate";

/* ──────────────────────────────────────────────────────────────────────────
 * The certificate itself — one landscape A4 sheet, drawn at a fixed size
 * (A4 at 96dpi) so it captures to PDF exactly as designed. Inline styles,
 * literal colours and inline SVG only: html2canvas reads those reliably.
 * Fonts are Inter (bundled) and a system serif for the name — never a web
 * font that might not have loaded when the PDF is captured.
 *
 * Design (20 Nov 2026, user — "they appear too plain"):
 *   - a navy frame with circuit-board traces running in from each corner
 *     (a tech brand's take on an ornamental border), a fine wave pattern in
 *     two corners and the logo as a faint watermark;
 *   - the logo, then the learner's name in a serif with a tapered gold rule;
 *   - the course as the large title. A module certificate leads "has
 *     successfully completed Module 2 of" and shows the course's modules as a
 *     row of steps (done · this one · still to come) with "Module 2 of 3 ·
 *     <name>" under it; a course certificate shows every module ticked
 *     (certificateWording in utils/certificate.js);
 *   - a seal in the foot between the date and the signatory, in the kind's
 *     colour (module sky, course gold, pathway navy, bootcamp mid blue);
 *   - a strip along the bottom: the partner school's logo ("In partnership
 *     with", school hubs only) or the learning hub, and the number with a QR
 *     to the public page that confirms it is genuine.
 * No sessions or hours are shown (user, 20 Nov 2026).
 *
 * Callers never show this at full size on a narrow screen; CertificateViewer
 * scales it to fit.
 * ────────────────────────────────────────────────────────────────────────── */

export const CERT_WIDTH = 1123;
export const CERT_HEIGHT = 794;

const NAVY = "#25476a";
const NAVY_DEEP = "#1a3550";
const MID = "#2e7db5";
const SKY = "#38aae1";
const GOLD = "#feb139";
const INK = "#111827";
const INK_MUTED = "#6B7280";
const LINE = "#E5E1D6";
const PAPER = "#FFFDF8";
const SERIF = 'Georgia, "Times New Roman", "Noto Serif", "DejaVu Serif", serif';

// Each kind's colour: the seal, the steps and the small rule under the logo.
const KIND_THEME = {
  module:   { accent: SKY,  deep: "#1F6F9E", label: "Module" },
  course:   { accent: GOLD, deep: "#9A6400", label: "Course" },
  pathway:  { accent: NAVY, deep: NAVY_DEEP, label: "Pathway" },
  bootcamp: { accent: MID,  deep: "#1D5B88", label: "Bootcamp" },
};

// [up to this many characters, font size] — long names step down so they stay on the sheet.
const NAME_SIZES = [[22, 56], [30, 48], [40, 40], [Infinity, 33]];
const TITLE_SIZES = [[30, 32], [48, 27], [70, 22], [Infinity, 19]];
// More steps than this and the row would crowd: the "Module 2 of 9" line says it instead.
const MAX_STEPS = 8;
// Module names under a course certificate's steps only while they fit.
const MAX_LABELLED_STEPS = 6;

const footLabel = { margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: INK_MUTED };
const footRule = { height: 1, backgroundColor: NAVY, margin: "8px 0 6px" };

// ── Ornament ────────────────────────────────────────────────────────────────

// One corner's circuit traces, drawn for the top-left and mirrored into the other three.
function CornerTraces() {
  const trace = { fill: "none", stroke: NAVY, strokeWidth: 2, strokeLinejoin: "round" };
  const thin = { ...trace, strokeWidth: 1.25, stroke: GOLD };
  return (
    <g>
      <path d="M46 230 L46 96 L96 46 L230 46" style={trace} />
      <path d="M58 160 L58 108 L108 58 L160 58" style={thin} />
      <path d="M70 120 L70 116 L116 70 L120 70" style={trace} />
      <path d="M46 150 L34 138" style={thin} />
      <path d="M150 46 L138 34" style={thin} />
      {[[46, 230], [230, 46], [58, 160], [160, 58], [70, 120], [120, 70]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={4} fill={GOLD} stroke={NAVY} strokeWidth={1.5} />
      ))}
      <circle cx={96} cy={96} r={5} fill="none" stroke={GOLD} strokeWidth={1.5} />
    </g>
  );
}

// Fine concentric arcs in a corner — the "security paper" texture, kept faint.
function CornerWaves({ color }) {
  return (
    <g style={{ opacity: 0.16 }}>
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={0} cy={0} r={70 + i * 11} fill="none" stroke={color} strokeWidth={1} />
      ))}
    </g>
  );
}

function Frame({ accent }) {
  const W = CERT_WIDTH;
  const H = CERT_HEIGHT;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <defs>
        <clipPath id="cert-inner"><rect x={33} y={33} width={W - 66} height={H - 66} /></clipPath>
      </defs>
      <g clipPath="url(#cert-inner)">
        <g transform={`translate(${W - 33} 33)`}><CornerWaves color={accent} /></g>
        <g transform={`translate(33 ${H - 33})`}><CornerWaves color={accent} /></g>
      </g>
      <rect x={22} y={22} width={W - 44} height={H - 44} rx={6} fill="none" stroke={NAVY} strokeWidth={3} />
      <rect x={32} y={32} width={W - 64} height={H - 64} rx={3} fill="none" stroke={GOLD} strokeWidth={1} />
      <CornerTraces />
      <g transform={`translate(${W} 0) scale(-1 1)`}><CornerTraces /></g>
      <g transform={`translate(0 ${H}) scale(1 -1)`}><CornerTraces /></g>
      <g transform={`translate(${W} ${H}) scale(-1 -1)`}><CornerTraces /></g>
    </svg>
  );
}

// The seal: a scalloped rosette in the kind's colour with ribbon tails, the brand and year around
// the ring, the kind (and a module's number) in the middle. System fonts only — an SVG drawn into
// the PDF can't use the page's web fonts.
function Seal({ kind, number, year }) {
  const theme = KIND_THEME[kind] || KIND_THEME.course;
  const size = 124;
  const c = size / 2;
  const points = 28;
  const scallop = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 58 : 52;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  const ring = `${BRAND_NAME} ★ Certified ★ ${year} ★`.toUpperCase();
  // Spread evenly round the whole ring, whatever the brand's name length.
  const ringLength = 2 * Math.PI * 36 - 6;
  const sealFont = "Helvetica, Arial, sans-serif";
  return (
    <svg width={size} height={size + 26} viewBox={`0 0 ${size} ${size + 26}`} aria-hidden="true">
      <defs>
        <path id="cert-seal-ring" d={`M ${c} ${c} m -36 0 a 36 36 0 1 1 72 0 a 36 36 0 1 1 -72 0`} />
      </defs>
      {/* ribbon tails */}
      <polygon points={`${c - 30},${c + 30} ${c - 44},${size + 24} ${c - 30},${size + 16} ${c - 18},${size + 24} ${c - 8},${c + 40}`} fill={theme.deep} />
      <polygon points={`${c + 30},${c + 30} ${c + 44},${size + 24} ${c + 30},${size + 16} ${c + 18},${size + 24} ${c + 8},${c + 40}`} fill={theme.deep} />
      <polygon points={scallop} fill={theme.accent} />
      <circle cx={c} cy={c} r={47} fill={PAPER} stroke={theme.deep} strokeWidth={1.5} />
      <circle cx={c} cy={c} r={27} fill="none" stroke={theme.accent} strokeWidth={1} />
      <text style={{ fontFamily: sealFont, fontSize: 8.6, fontWeight: 700, letterSpacing: 1.1, fill: theme.deep }}>
        <textPath href="#cert-seal-ring" startOffset="0" textLength={ringLength} lengthAdjust="spacing">{ring}</textPath>
      </text>
      {number ? (
        <>
          <text x={c} y={c - 5} textAnchor="middle" style={{ fontFamily: sealFont, fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, fill: NAVY }}>{theme.label.toUpperCase()}</text>
          <text x={c} y={c + 15} textAnchor="middle" style={{ fontFamily: sealFont, fontSize: 22, fontWeight: 800, fill: NAVY_DEEP }}>{number}</text>
        </>
      ) : (
        <>
          <path d={`M ${c - 9} ${c - 6} l 6 6 l 12 -12`} fill="none" stroke={theme.deep} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <text x={c} y={c + 15} textAnchor="middle" style={{ fontFamily: sealFont, fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, fill: NAVY }}>{theme.label.toUpperCase()}</text>
        </>
      )}
    </svg>
  );
}

// The course's modules as steps: done (filled, ticked), this one (gold, numbered), still to come
// (outlined). A course certificate has every step done.
function Steps({ count, current, labels, accent }) {
  const steps = Array.from({ length: count }, (_, i) => i + 1);
  const withLabels = labels.length === count && count <= MAX_LABELLED_STEPS;
  const stepWidth = withLabels ? 118 : 46;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginTop: 18 }}>
      {steps.map((n) => {
        const done = current == null || n < current;
        const here = n === current;
        const size = here ? 34 : 28;
        return (
          <div key={n} style={{ display: "flex", alignItems: "flex-start" }}>
            {n > 1 && <div style={{ width: withLabels ? 26 : 34, height: 2, marginTop: 16, backgroundColor: done || here ? accent : LINE }} />}
            <div style={{ width: stepWidth, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{
                  width: size, height: size, borderRadius: "50%", boxSizing: "border-box",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: here ? GOLD : done ? accent : PAPER,
                  border: here ? `3px solid ${NAVY_DEEP}` : done ? "none" : `2px solid ${LINE}`,
                  color: here ? NAVY_DEEP : INK_MUTED, fontSize: 13, fontWeight: 800,
                }}>
                  {done && !here
                    ? <span style={{ display: "inline-block", width: 6, height: 11, marginTop: -3, borderRight: "2.5px solid #fff", borderBottom: "2.5px solid #fff", transform: "rotate(45deg)" }} />
                    : n}
                </div>
              </div>
              {withLabels && (
                <p style={{ margin: "6px 0 0", width: stepWidth, fontSize: 11, lineHeight: 1.3, fontWeight: 600, color: NAVY_DEEP, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {labels[n - 1]}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Foot ─────────────────────────────────────────────────────────────────────

// The signature above the signatory's name. An image that fails to load (a removed upload) just
// leaves the name and title — never a broken-image icon on a certificate.
function Signatory({ signatory }) {
  const [failed, setFailed] = useState(false);
  return (
    <div style={{ width: 260, textAlign: "center" }}>
      <div style={{ height: 54, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {signatory.image && !failed && (
          <img src={signatory.image} alt="" crossOrigin="anonymous" onError={() => setFailed(true)} style={{ maxHeight: 54, maxWidth: 220, objectFit: "contain" }} />
        )}
      </div>
      <div style={footRule} />
      {signatory.name && <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>{signatory.name}</p>}
      {signatory.title && <p style={{ ...footLabel, marginTop: 3 }}>{signatory.title}</p>}
    </div>
  );
}

// "In partnership with" a school's logo, else the learning hub's name. A logo that won't load
// falls back to the name.
function Partner({ hubName, hubLogo }) {
  const [failed, setFailed] = useState(false);
  if (!hubName && !hubLogo) return <div />;
  const showLogo = hubLogo && !failed;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", minWidth: 0 }}>
      {showLogo && (
        <img src={hubLogo} alt="" crossOrigin="anonymous" onError={() => setFailed(true)} style={{ height: 44, maxWidth: 120, objectFit: "contain" }} />
      )}
      <div style={{ minWidth: 0 }}>
        <p style={footLabel}>{showLogo ? "In partnership with" : "Learning hub"}</p>
        {hubName && <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 700, color: INK, maxWidth: 330, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hubName}</p>}
      </div>
    </div>
  );
}

// ── The sheet ────────────────────────────────────────────────────────────────

export default function CertificateDocument({ certificate, id }) {
  const c = certificateFields(certificate);
  const url = verifyUrl(c.verifyToken);
  const words = certificateWording(c);
  const theme = KIND_THEME[c.kind] || KIND_THEME.course;
  const year = c.issuedAt ? new Date(c.issuedAt).getFullYear() : new Date().getFullYear();

  // Steps: a module's place among its course's modules, or every module of a course, done.
  const steps = c.kind === "module" && c.moduleNumber && c.moduleCount && c.moduleCount <= MAX_STEPS
    ? { count: c.moduleCount, current: c.moduleNumber, labels: [] }
    : c.kind === "course" && words.modules.length >= 2 && words.modules.length <= MAX_STEPS
      ? { count: words.modules.length, current: null, labels: words.modules }
      : null;
  // A course with more modules than the steps can show says so in words.
  const courseSummary = c.kind === "course" && words.modules.length > MAX_STEPS ? `All ${words.modules.length} modules completed` : "";

  return (
    <div
      id={id}
      style={{
        position: "relative", width: CERT_WIDTH, height: CERT_HEIGHT, boxSizing: "border-box",
        backgroundColor: PAPER, fontFamily: "Inter, Helvetica, Arial, sans-serif", color: INK, overflow: "hidden",
      }}
    >
      {/* the logo, very faint, behind everything */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={BRAND_LOGO} alt="" crossOrigin="anonymous" style={{ width: 640, opacity: 0.045, objectFit: "contain" }} />
      </div>

      <Frame accent={theme.accent} />

      {/* inset clear of the corner traces (they reach 70px in from each edge along the foot) */}
      <div style={{ position: "absolute", top: 62, right: 110, bottom: 80, left: 110, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <img src={BRAND_LOGO} alt={BRAND_NAME} crossOrigin="anonymous" style={{ height: 76, objectFit: "contain" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
          <div style={{ width: 36, height: 2, backgroundColor: GOLD }} />
          <div style={{ width: 8, height: 8, backgroundColor: theme.accent, transform: "rotate(45deg)" }} />
          <div style={{ width: 36, height: 2, backgroundColor: GOLD }} />
        </div>

        {/* who and what, centred between the logo and the foot */}
        <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: INK_MUTED }}>This certifies that</p>
          <p style={{ margin: "12px 0 0", fontFamily: SERIF, fontSize: fitSize(c.learnerName, NAME_SIZES), lineHeight: 1.12, fontWeight: 700, color: NAVY_DEEP, maxWidth: 880, overflowWrap: "anywhere" }}>
            {c.learnerName}
          </p>
          <div style={{ width: 460, height: 3, marginTop: 12, background: `linear-gradient(90deg, rgba(254,177,57,0) 0%, ${GOLD} 25%, ${GOLD} 75%, rgba(254,177,57,0) 100%)` }} />

          <p style={{ margin: "18px 0 0", fontSize: 16, color: INK_MUTED }}>{words.lead}</p>
          <p style={{ margin: "8px 0 0", fontSize: fitSize(words.title, TITLE_SIZES), lineHeight: 1.2, fontWeight: 800, color: INK, letterSpacing: "0.01em", maxWidth: 860, overflowWrap: "anywhere" }}>
            {words.title}
          </p>
          {steps && <Steps count={steps.count} current={steps.current} labels={steps.labels} accent={theme.accent} />}
          {(words.detail || courseSummary) && (
            <p style={{ margin: "12px 0 0", fontSize: 16, fontWeight: 600, color: NAVY, maxWidth: 820, overflowWrap: "anywhere" }}>{words.detail || courseSummary}</p>
          )}
        </div>

        {/* date · seal · signatory */}
        <div style={{ width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "space-between", textAlign: "left" }}>
          <div style={{ width: 260 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: INK }}>{formatCertificateDate(c.issuedAt)}</p>
            <div style={footRule} />
            <p style={footLabel}>Date awarded</p>
          </div>
          <div style={{ marginBottom: -8 }}>
            <Seal kind={c.kind} number={c.kind === "module" ? c.moduleNumber : null} year={year} />
          </div>
          {c.signatory ? <Signatory signatory={c.signatory} /> : <div style={{ width: 260 }} />}
        </div>

        {/* partner / hub · number and verification */}
        <div style={{ width: "100%", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <Partner hubName={c.hubName} hubLogo={c.hubLogo} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ textAlign: "right" }}>
              <p style={footLabel}>Certificate no.</p>
              <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 700, color: INK }}>{c.number}</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: INK_MUTED }}>Scan to confirm it is genuine</p>
            </div>
            {url && <QRCodeCanvas value={url} size={58} marginSize={0} fgColor={NAVY_DEEP} bgColor={PAPER} />}
          </div>
        </div>
      </div>
    </div>
  );
}
