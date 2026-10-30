import { useState } from "react";
import { FiActivity, FiChevronDown, FiChevronUp, FiGlobe } from "react-icons/fi";
import { T, cardStyle, KID, KidHeading } from "./theme";
import { useDiagnosticReports } from "../../../assessments/hooks/useAssessmentSubmission";

// System colours: navy for the score, sky blue for the bars.
const ACCENT = "#25476a";
const BAR = "#38aae1";

const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null);

function Bar({ percent, color = BAR }) {
  return (
    <div style={{ height: 10, borderRadius: 999, backgroundColor: "#EEF0F4", overflow: "hidden", flex: 1, minWidth: 80 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
    </div>
  );
}

function CompetencyRow({ competency }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 0" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "Inter, sans-serif", textAlign: "left" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, flex: "0 1 220px", minWidth: 0 }}>{competency.name}</span>
        <Bar percent={competency.percent} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, width: 42, textAlign: "right" }}>{competency.percent}%</span>
        {open ? <FiChevronUp size={14} color={T.inkFaint} /> : <FiChevronDown size={14} color={T.inkFaint} />}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0 2px 14px" }}>
          {competency.indicators.map((indicator) => (
            <div key={indicator.indicatorId} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: T.inkMuted, flex: "0 1 206px", minWidth: 0 }}>{indicator.name}</span>
              <Bar percent={indicator.percent} color="#7FC4EA" />
              <span style={{ fontSize: 11.5, color: T.inkMuted, width: 70, textAlign: "right" }}>{indicator.marksEarned}/{indicator.marksPossible}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Report({ report, staff }) {
  const fromWebsite = report.source === "website";
  return (
    <div style={{ padding: "16px 18px", borderRadius: 18, backgroundColor: "#F7FAFD", border: `1.5px solid ${T.tintBorder}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.ink }}>{report.pathwayName}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>
            {report.assessmentName}{report.takenAt ? ` · ${formatDate(report.takenAt)}` : ""}
          </p>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: fromWebsite ? "#E8F5FB" : "#EDF2F8", color: fromWebsite ? "#2e7db5" : "#25476a", border: `1px solid ${fromWebsite ? "#A8D5EE" : "#C5D4E5"}` }}>
            {fromWebsite && <FiGlobe size={11} />} {fromWebsite ? "Taken on the website before enrolling" : "Taken in the portal"}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: ACCENT }}>{report.percent}%</p>
          <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>{report.totalScore}/{report.maxScore} marks</p>
        </div>
      </div>

      {report.placedCourseName && (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: T.ink }}>
          Placed {staff ? "them" : "you"} at <strong>{report.placedCourseName}</strong> on this pathway.
        </p>
      )}
      {report.placedBandName && (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: T.ink }}>
          Placed {staff ? "them" : "you"} in the <strong>{report.placedBandName}</strong> band.
        </p>
      )}

      {report.competencies.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Competencies</p>
          {report.competencies.map((competency) => <CompetencyRow key={competency.competencyId || competency.name} competency={competency} />)}
        </div>
      ) : (
        <p style={{ margin: "12px 0 0", fontSize: 12, color: T.inkFaint }}>This diagnostic's questions aren't linked to competencies.</p>
      )}
    </div>
  );
}

// The diagnostic report on a learner's profile (learner, parent and staff alike): each marked
// diagnostic of this hub's curriculum — a pathway's, taken on the website before enrolling or in
// the portal, or an older Developmental Stage one — with its score, the course it placed them at, and the marks per competency
// (each opening to its indicators). The same marks count towards the Competencies tab and Progress
// Arc (server: website-diagnostic.service.js, getLearnerIndicatorProgress). Nothing shows until one
// is marked.
export default function DiagnosticReportCard({ learnerId, curriculumId, staff = false }) {
  const { data: reports = [], isLoading } = useDiagnosticReports(learnerId, curriculumId);
  if (isLoading || !curriculumId || reports.length === 0) return null;
  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <KidHeading icon={FiActivity} tone={KID.navy} sub={`${staff ? "Where this learner started" : "Where you started"} — these marks count towards ${staff ? "their" : "your"} skills and progress.`}>
        Diagnostic report
      </KidHeading>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {reports.map((report) => <Report key={report.issueId} report={report} staff={staff} />)}
      </div>
    </div>
  );
}
