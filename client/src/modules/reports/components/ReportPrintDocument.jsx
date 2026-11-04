import { useState } from "react";
import { BRAND_NAME, BRAND_LOGO_DARK_BG, BRAND_LOGO_DARK_BG_FILTER } from "../../../branding";
import { LEVELS, buildReportView } from "../utils/reportView";

/* ──────────────────────────────────────────────────────────────────────────
 * A print-optimised, branded rendering of a single published report — the
 * thing a learner/guardian actually downloads or prints. Deliberately its own
 * component (not the on-screen ReportDetailPage layout): fixed A4-ish width,
 * page-break rules, no interactive/collapsed sections, and the three marks the
 * brief calls for up top — the brand wordmark, the hub's own logo, and the
 * learner's profile photo.
 *
 * Everything it needs is passed in as plain props (report + the learner/hub
 * already resolved by the portal's own scope) so it has no data fetching of its
 * own and can be captured by html2canvas as-is. Its body reads like the on-screen report
 * (ReportView, both from buildReportView): level words and bars, never raw marks.
 * ────────────────────────────────────────────────────────────────────────── */

const NAVY = "#25476a";
const NAVY_DEEP = "#1a3550";
const INK = "#111827";
const INK_MUTED = "#6B7280";
const INK_FAINT = "#9CA3AF";
const BORDER = "#E5E7EB";
const TINT = "#e8f5fb";
const TINT_BORDER = "#a8d5ee";
function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "—";
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

function Bar({ percent, color, height = 8 }) {
  return (
    <div style={{ height, borderRadius: 999, background: "#EEF0F4", overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${Math.max(2, Math.min(100, percent))}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}

function Pill({ level }) {
  return <span style={{ fontSize: 9.5, fontWeight: 800, color: level.color, background: level.soft, border: `1px solid ${level.border}`, borderRadius: 20, padding: "1px 8px", whiteSpace: "nowrap" }}>{level.label}</span>;
}

function Box({ children, tone }) {
  const tones = { plain: ["#fff", BORDER], tint: [TINT, TINT_BORDER], warm: ["#FFF5E1", "#FDD89A"] };
  const [bg, border] = tones[tone || "plain"];
  return <div style={{ padding: "12px 14px", border: `1px solid ${border}`, borderRadius: 10, background: bg, breakInside: "avoid" }}>{children}</div>;
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: NAVY, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 4, height: 14, borderRadius: 2, background: NAVY, display: "inline-block" }} />
      {children}
    </h2>
  );
}

/* ── The document ─────────────────────────────────────────────────────── */

export default function ReportPrintDocument({ report, learner, hub, gradeName, audience = "parent" }) {
  const content = report.content || {};
  const view = buildReportView(report, { audience, firstName: learner?.firstName || "" });

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

        {/* Brand wordmark + hub logo on one line */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <img src={BRAND_LOGO_DARK_BG} alt={BRAND_NAME} style={{ height: 30, width: "auto", objectFit: "contain", filter: BRAND_LOGO_DARK_BG_FILTER }} />
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

        {view.notSubmitted ? (
          <Box tone="warm">
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: INK }}>Not handed in</p>
            <p style={{ margin: "4px 0 0", fontSize: 11.5, color: INK_MUTED }}>The work for this session wasn’t handed in, so there was nothing to mark: {view.notSubmittedAssessments.map((x) => x.name).join(", ") || "—"}.</p>
          </Box>
        ) : (
          <>
            {/* How it went */}
            <div style={{ padding: "18px 22px", border: `1.5px solid ${TINT_BORDER}`, background: TINT, borderRadius: 12, breakInside: "avoid" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ width: 84, height: 84, borderRadius: "50%", border: `8px solid ${view.level.fill}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxSizing: "border-box" }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: INK }}>{view.percent}%</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: INK_MUTED }}>{isSession ? "How this session went" : "How the course went"}</p>
                  <p style={{ margin: "3px 0 4px", fontSize: 20, fontWeight: 900, color: view.level.color }}>
                    {view.level.label}
                    {view.band && <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: NAVY, background: "#fff", border: `1px solid ${TINT_BORDER}`, borderRadius: 20, padding: "2px 9px", verticalAlign: "middle" }}>Level: {view.band}</span>}
                  </p>
                  {view.sentence && <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: INK }}>{view.sentence}</p>}
                  <p style={{ margin: "4px 0 0", fontSize: 10.5, color: INK_MUTED }}>{view.marked} {view.marked === 1 ? "assessment" : "assessments"} marked{view.pending > 0 ? ` · ${view.pending} more still to be marked` : ""}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
                {LEVELS.map((l) => (
                  <div key={l.key} style={{ flex: 1 }}>
                    <div style={{ height: 5, borderRadius: 999, background: l.key === view.level.key ? l.fill : "#fff" }} />
                    <p style={{ margin: "3px 0 0", fontSize: 9, fontWeight: l.key === view.level.key ? 800 : 600, color: l.key === view.level.key ? l.color : INK_FAINT }}>{l.label} · {l.min}–{l.max}%</p>
                  </div>
                ))}
              </div>
            </div>

            {/* From the teacher + at home */}
            {(view.comments.length > 0 || view.homeNote) && (
              <div style={{ display: "grid", gridTemplateColumns: view.comments.length && view.homeNote ? "1fr 1fr" : "1fr", gap: 12, breakInside: "avoid" }}>
                {view.comments.length > 0 && (
                  <div>
                    <SectionTitle>From the teacher</SectionTitle>
                    <Box tone="tint">
                      {view.comments.map((c, i) => (
                        <div key={c.key} style={{ marginTop: i ? 10 : 0 }}>
                          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: INK, fontStyle: "italic", whiteSpace: "pre-line" }}>“{c.text}”</p>
                          <p style={{ margin: "3px 0 0", fontSize: 9.5, color: INK_FAINT }}>{[c.by, c.about, c.at ? fmtDate(c.at) : null].filter(Boolean).join(" · ")}</p>
                        </div>
                      ))}
                    </Box>
                  </div>
                )}
                {view.homeNote && (
                  <div>
                    <SectionTitle>How to help at home</SectionTitle>
                    <Box tone="warm"><p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: INK, whiteSpace: "pre-line" }}>{view.homeNote}</p></Box>
                  </div>
                )}
              </div>
            )}

            {/* Doing well / to practise next */}
            {view.competencies.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, breakInside: "avoid" }}>
                {[["Doing well", view.strengths, "#2e7db5", "Nothing stands out yet."], ["To practise next", view.practise, "#feb139", "Nothing below halfway."]].map(([label, items, color, empty]) => (
                  <div key={label}>
                    <SectionTitle>{label}</SectionTitle>
                    <Box>
                      {items.length === 0 && <p style={{ margin: 0, fontSize: 11, color: INK_MUTED }}>{empty}</p>}
                      {items.map((x, i) => (
                        <div key={x.id} style={{ marginTop: i ? 8 : 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>{x.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: INK }}>{x.percent}%</span>
                          </div>
                          <div style={{ marginTop: 4, display: "flex" }}><Bar percent={x.percent} color={color} height={6} /></div>
                        </div>
                      ))}
                    </Box>
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {view.competencies.length > 0 && (
              <div>
                <SectionTitle>Skills</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {view.competencies.map((c) => (
                    <Box key={c.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: INK, flex: "0 0 34%" }}>{c.name}</span>
                        <Bar percent={c.percent} color={c.level.fill} />
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: INK, width: 36, textAlign: "right" }}>{c.percent}%</span>
                        <Pill level={c.level} />
                      </div>
                      {c.indicators.length > 0 && (
                        <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px dashed ${BORDER}`, display: "flex", flexDirection: "column", gap: 5 }}>
                          {c.indicators.map((i) => (
                            <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 10.5, color: INK_MUTED, flex: "0 0 34%" }}>{i.name}</span>
                              <Bar percent={i.percent} color={i.level.fill} height={5} />
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: INK_MUTED, width: 36, textAlign: "right" }}>{i.percent}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Box>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions (course report) and assessments */}
            {[["Sessions in this course", view.sessionReports.map((x) => ({ key: x.sessionId, name: x.sessionTitle || "Session", percent: x.percent, level: x.level }))],
              [isSession ? "This session’s work" : "Assessments", view.assessments.map((x) => ({ key: x.assessmentId, name: x.name, sub: x.gradedAt ? `Marked ${fmtDate(x.gradedAt)}` : null, percent: x.percent, level: x.level }))]]
              .filter(([, rows]) => rows.length > 0)
              .map(([label, rows]) => (
                <div key={label} style={{ breakInside: "avoid" }}>
                  <SectionTitle>{label}</SectionTitle>
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                    {rows.map((r, i) => (
                      <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderTop: i ? `1px solid ${BORDER}` : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: INK }}>{r.name}</p>
                          {r.sub && <p style={{ margin: "1px 0 0", fontSize: 9.5, color: INK_FAINT }}>{r.sub}</p>}
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: INK }}>{r.percent}%</span>
                        <Pill level={r.level} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            {/* What's next */}
            {isSession && (view.nextSessionTitle || view.sessionNumber) && (
              <Box>
                <p style={{ margin: 0, fontSize: 11.5, color: INK }}>
                  <strong>What’s next: </strong>
                  {[view.sessionNumber && view.sessionCount ? `session ${view.sessionNumber} of ${view.sessionCount}` : null, view.nextSessionTitle ? `up next, ${view.nextSessionTitle}` : null, view.practise[0] ? `practising ${view.practise[0].name} will help most` : null].filter(Boolean).join(" · ")}.
                </p>
              </Box>
            )}
          </>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 32px", borderTop: `1px solid ${BORDER}`, background: "#FAFBFF", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 9.5, color: INK_FAINT }}>
          Generated by {BRAND_NAME}{hub?.name ? ` · ${hub.name}` : ""} · {fmtDate(new Date().toISOString())}
        </p>
        <p style={{ margin: 0, fontSize: 9.5, color: INK_FAINT }}>
          This report reflects assessments published to the learner as of the date shown.
        </p>
      </div>
    </div>
  );
}
