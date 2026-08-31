import { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

function sectionLabel() {
  return { margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" };
}

function formatWhen(iso) {
  return iso ? new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "";
}

function ScoreRow({ item }) {
  return (
    <div style={{ padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{item.name}</p>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: item.percent >= 60 ? "#059669" : "#DC2626" }}>{item.totalScore}/{item.maxScore} · {item.percent}%</span>
      </div>
      {item.feedback && (
        <>
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.ink, fontStyle: "italic", borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>“{item.feedback}”</p>
          {(item.gradedByName || item.gradedAt) && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: T.inkFaint }}>
              {item.gradedByName ? `— ${item.gradedByName}` : ""}
              {item.gradedByName && item.gradedAt ? " · " : ""}
              {formatWhen(item.gradedAt)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function IndicatorRow({ ind }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.ink }}>{ind.indicatorName}</p>
        <p style={{ margin: 0, fontSize: 11, color: T.inkFaint }}>{ind.competencyName}</p>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: ind.percent >= 60 ? "#059669" : "#DC2626", whiteSpace: "nowrap" }}>
        {ind.marksEarned}/{ind.marksPossible} · {ind.percent}%
      </span>
    </div>
  );
}

function CompetencyScoreRow({ cs }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.ink }}>{cs.name}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{cs.score}%</span>
        {cs.level && <span style={{ fontSize: 11, color: T.inkFaint }}>{cs.level.name}</span>}
        {cs.band && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: T.accent, backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, borderRadius: 20, padding: "1px 8px" }}>
            {cs.band.name}
          </span>
        )}
      </div>
    </div>
  );
}

function SessionSummaryRow({ item }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{item.sessionTitle || "Untitled session"}</p>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: item.percent >= 60 ? "#059669" : "#DC2626" }}>{item.totalScore}/{item.maxScore} · {item.percent}%</span>
    </div>
  );
}

// Everything past "the general important stuff" (name, overall score, remarks — all rendered by
// the page itself, above this) — the per-session breakdown, every individual assessment's score
// and feedback, and both competency views. Shared between the teacher's editor and the learner's
// own report page, since the content shape is identical either side of the publish boundary.
// `defaultOpen` controls the starting state: the teacher's editor leaves it collapsed (a report
// reads as one number first, detail one click away), while the learner's own report opens it
// straight away — a learner clicking "View Report" wants the whole thing, not a second click.
export default function ReportDetailSections({ content, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const sessionReports = content.sessionReports || [];
  const assessments = content.assessments || [];
  const competencyScores = content.competencyScores || [];
  const indicatorBreakdown = content.indicatorBreakdown || [];

  const detailCount = assessments.length + competencyScores.length + indicatorBreakdown.length + sessionReports.length;
  if (detailCount === 0) return null;

  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>Full Details</p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkFaint }}>
            {assessments.length} assessment{assessments.length === 1 ? "" : "s"}{competencyScores.length > 0 ? ` · ${competencyScores.length} competenc${competencyScores.length === 1 ? "y" : "ies"}` : ""}
          </p>
        </div>
        {open ? <FiChevronUp color={T.inkMuted} /> : <FiChevronDown color={T.inkMuted} />}
      </button>

      {open && (
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
          {sessionReports.length > 0 && (
            <div>
              <p style={sectionLabel()}>Built from {sessionReports.length} session{sessionReports.length === 1 ? "" : "s"}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessionReports.map((item) => <SessionSummaryRow key={item.sessionId} item={item} />)}
              </div>
            </div>
          )}

          {assessments.length > 0 && (
            <div>
              <p style={sectionLabel()}>Assessments</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {assessments.map((item) => <ScoreRow key={item.assessmentId} item={item} />)}
              </div>
            </div>
          )}

          {competencyScores.length > 0 && (
            <div>
              <p style={sectionLabel()}>Competency Standing</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {competencyScores.map((cs) => <CompetencyScoreRow key={cs.competencyId} cs={cs} />)}
              </div>
            </div>
          )}

          {indicatorBreakdown.length > 0 && (
            <div>
              <p style={sectionLabel()}>Competency Breakdown</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {indicatorBreakdown.map((ind) => <IndicatorRow key={ind.indicatorId} ind={ind} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
