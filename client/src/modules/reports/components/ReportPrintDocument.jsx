import { useState } from "react";
import digifunziLogo from "../../../assets/Logo-image.png";

/* ──────────────────────────────────────────────────────────────────────────
 * A print-optimised, branded rendering of a single published report — the
 * thing a learner/guardian actually downloads or prints. Deliberately its own
 * component (not the on-screen ReportDetailPage layout): fixed A4-ish width,
 * page-break rules, no interactive/collapsed sections, and the three marks the
 * brief calls for up top — the Digifunzi wordmark, the hub's own logo, and the
 * learner's profile photo.
 *
 * Everything it needs is passed in as plain props (report + the learner/hub
 * already resolved by the portal's own scope) so it has no data fetching of its
 * own and can be captured by html2canvas as-is.
 * ────────────────────────────────────────────────────────────────────────── */

const NAVY = "#25476a";
const NAVY_DEEP = "#1a3550";
const INK = "#111827";
const INK_MUTED = "#6B7280";
const INK_FAINT = "#9CA3AF";
const BORDER = "#E5E7EB";
const TINT = "#e8f5fb";
const TINT_BORDER = "#a8d5ee";
const GOOD = "#059669";
const BAD = "#DC2626";

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "—";
}
function fmtDateTime(iso) {
  return iso ? new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "";
}
function scoreColor(percent) {
  return percent >= 60 ? GOOD : BAD;
}
function initials(a, b) {
  return `${(a || "")[0] || ""}${(b || "")[0] || ""}`.toUpperCase() || "?";
}

/* ── Small building blocks ─────────────────────────────────────────────── */

// The hub's own logo tile in the header. Falls back to a monogram badge if there's no photo, or
// if the photo fails to load (a stale/removed upload) — never a broken-image icon on the report.
function HubMark({ src, monogram }) {
  const [failed, setFailed] = useState(false);
  const box = { height: 40, width: 40, borderRadius: 10, border: "2px solid rgba(255,255,255,0.5)", flexShrink: 0, objectFit: "cover", background: "#fff" };
  if (src && !failed) {
    return <img src={src} alt="" crossOrigin="anonymous" onError={() => setFailed(true)} style={box} />;
  }
  return (
    <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.14)", color: "#fff", fontWeight: 900, fontSize: 13 }}>
      {monogram}
    </div>
  );
}

function Avatar({ src, fallback, size = 64, ring = "#fff" }) {
  const [failed, setFailed] = useState(false);
  const common = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    border: `3px solid ${ring}`, objectFit: "cover",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  };
  if (src && !failed) return <img src={src} alt="" crossOrigin="anonymous" onError={() => setFailed(true)} style={common} />;
  return (
    <div style={{ ...common, background: "linear-gradient(135deg, #2e7db5, #38aae1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: size * 0.34 }}>
      {fallback}
    </div>
  );
}

function IdentityField({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: INK_FAINT }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 12.5, fontWeight: 600, color: INK }}>{value || "—"}</p>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: NAVY, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 4, height: 14, borderRadius: 2, background: NAVY, display: "inline-block" }} />
      {children}
    </h2>
  );
}

function Row({ left, sub, right, rightColor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#FAFBFF", breakInside: "avoid" }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: INK }}>{left}</p>
        {sub && <p style={{ margin: "1px 0 0", fontSize: 10, color: INK_FAINT }}>{sub}</p>}
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", color: rightColor || INK }}>{right}</span>
    </div>
  );
}

/* ── The document ─────────────────────────────────────────────────────── */

export default function ReportPrintDocument({ report, learner, hub, gradeName }) {
  const content = report.content || {};
  const overall = content.overall || { totalScore: 0, maxScore: 0, percent: 0 };
  const assessments = content.assessments || [];
  const competencyScores = content.competencyScores || [];
  const indicatorBreakdown = content.indicatorBreakdown || [];
  const sessionReports = content.sessionReports || [];

  const isSession = !!report.sessionId;
  const courseName = content.courseName || "Course";
  const sessionName = content.sessionName || null;
  const title = isSession
    ? (sessionName ? `${courseName} · ${sessionName}` : `${courseName} · Session Report`)
    : `${courseName} · Progress Report`;

  const learnerName = learner ? `${learner.firstName || ""} ${learner.lastName || ""}`.trim() : "Learner";
  const hubName = hub?.name || "Learning Hub";
  const hubMonogram = hubName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "H";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 820,
        margin: "0 auto",
        background: "#fff",
        color: INK,
        fontFamily: "Inter, system-ui, sans-serif",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      {/* ── Branded header ──────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 55%, #2e7db5 100%)`, color: "#fff", padding: "26px 32px 30px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -50, right: -30, width: 190, height: 190, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        {/* Digifunzi wordmark + hub logo on one line */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <img src={digifunziLogo} alt="Digifunzi" style={{ height: 30, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HubMark src={hub?.photo} monogram={hubMonogram} />
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800 }}>{hubName}</p>
              {gradeName && <p style={{ margin: "1px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.7)" }}>{gradeName}</p>}
            </div>
          </div>
        </div>

        {/* Report title + learner identity */}
        <div style={{ position: "relative", marginTop: 24, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <Avatar src={learner?.photo} fallback={initials(learner?.firstName, learner?.lastName)} size={66} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "#9BD7F2" }}>
              {isSession ? "Session Report" : "Progress Report"}
            </p>
            <h1 style={{ margin: "4px 0 3px", fontSize: 21, fontWeight: 900, lineHeight: 1.2 }}>{learnerName}</h1>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.78)" }}>{title}</p>
          </div>
        </div>
      </div>

      {/* ── Identity strip ─────────────────────────────────────────── */}
      <div style={{ padding: "16px 32px", borderBottom: `1px solid ${BORDER}`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16, background: "#FAFBFF" }}>
        <IdentityField label="Learner" value={learnerName} />
        <IdentityField label="Admission No." value={hub?.admissionNumber || learner?.registrationNumber} />
        <IdentityField label="Learning Hub" value={hubName} />
        {gradeName && <IdentityField label="Class" value={gradeName} />}
        <IdentityField label="Course" value={courseName} />
        {isSession && <IdentityField label="Session" value={sessionName || "—"} />}
        <IdentityField label="Published" value={fmtDate(report.publishedAt)} />
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 32px 30px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Overall result */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 22px", border: `1.5px solid ${TINT_BORDER}`, background: TINT, borderRadius: 12, breakInside: "avoid" }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: NAVY, lineHeight: 1 }}>{overall.percent}%</p>
            <p style={{ margin: "4px 0 0", fontSize: 10.5, fontWeight: 700, color: INK_MUTED }}>OVERALL</p>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: TINT_BORDER }} />
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: INK }}>{overall.totalScore} / {overall.maxScore} marks</p>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: INK_MUTED }}>
              Across {assessments.length} assessment{assessments.length === 1 ? "" : "s"}
              {isSession ? " in this session" : " in this course"}
            </p>
          </div>
        </div>

        {/* Educator remarks */}
        {report.remarks && (
          <div style={{ breakInside: "avoid" }}>
            <SectionTitle>Educator Remarks</SectionTitle>
            <div style={{ padding: "14px 16px", border: `1px solid ${BORDER}`, borderRadius: 10, background: "#fff", fontSize: 12.5, lineHeight: 1.6, color: INK, fontStyle: "italic" }}>
              “{report.remarks}”
            </div>
          </div>
        )}

        {/* Session breakdown (course-level report only) */}
        {sessionReports.length > 0 && (
          <div style={{ breakInside: "avoid" }}>
            <SectionTitle>Session Breakdown</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sessionReports.map((s) => (
                <Row
                  key={s.sessionId}
                  left={s.sessionTitle || "Untitled session"}
                  right={`${s.totalScore}/${s.maxScore} · ${s.percent}%`}
                  rightColor={scoreColor(s.percent)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Assessments */}
        {assessments.length > 0 && (
          <div style={{ breakInside: "avoid" }}>
            <SectionTitle>Assessments</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {assessments.map((a) => (
                <div key={a.assessmentId} style={{ padding: "11px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, background: "#FAFBFF", breakInside: "avoid" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: INK }}>{a.name}</p>
                    <span style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", color: scoreColor(a.percent) }}>
                      {a.totalScore}/{a.maxScore} · {a.percent}%
                    </span>
                  </div>
                  {a.feedback && (
                    <>
                      <p style={{ margin: "8px 0 0", paddingTop: 8, borderTop: `1px solid ${BORDER}`, fontSize: 11.5, fontStyle: "italic", color: INK }}>“{a.feedback}”</p>
                      {(a.gradedByName || a.gradedAt) && (
                        <p style={{ margin: "4px 0 0", fontSize: 9.5, color: INK_FAINT }}>
                          {a.gradedByName ? `— ${a.gradedByName}` : ""}{a.gradedByName && a.gradedAt ? " · " : ""}{fmtDateTime(a.gradedAt)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competency standing */}
        {competencyScores.length > 0 && (
          <div style={{ breakInside: "avoid" }}>
            <SectionTitle>Competency Standing</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {competencyScores.map((cs) => (
                <div key={cs.competencyId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#FAFBFF", breakInside: "avoid" }}>
                  <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: INK }}>{cs.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: NAVY }}>{cs.score}%</span>
                    {cs.level?.name && <span style={{ fontSize: 10, color: INK_FAINT }}>{cs.level.name}</span>}
                    {cs.band?.name && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: NAVY, background: TINT, border: `1px solid ${TINT_BORDER}`, borderRadius: 20, padding: "1px 8px" }}>{cs.band.name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indicator breakdown */}
        {indicatorBreakdown.length > 0 && (
          <div style={{ breakInside: "avoid" }}>
            <SectionTitle>Competency Breakdown</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {indicatorBreakdown.map((ind) => (
                <Row
                  key={ind.indicatorId}
                  left={ind.indicatorName}
                  sub={ind.competencyName}
                  right={`${ind.marksEarned}/${ind.marksPossible} · ${ind.percent}%`}
                  rightColor={scoreColor(ind.percent)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 32px", borderTop: `1px solid ${BORDER}`, background: "#FAFBFF", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 9.5, color: INK_FAINT }}>
          Generated by Digifunzi{hub?.name ? ` · ${hub.name}` : ""} · {fmtDate(new Date().toISOString())}
        </p>
        <p style={{ margin: 0, fontSize: 9.5, color: INK_FAINT }}>
          This report reflects assessments published to the learner as of the date shown.
        </p>
      </div>
    </div>
  );
}
