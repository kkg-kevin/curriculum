import { useNavigate, useOutletContext } from "react-router-dom";
import { FiAward, FiFileText } from "react-icons/fi";
import { useMyReports } from "../../reports/hooks/useReports";
import { useDiagnosticForLearner, useLearningAreaDiagnosticsForLearner } from "../../assessments/hooks/useAssessmentSubmission";
import { T, cardStyle } from "./profile/theme";

// A session report (report.sessionId set) is a smaller, secondary row; the final course report
// (sessionId null/absent) is the primary one — same visual weighting the teacher-portal gives the
// course-level report vs. its session breakdown.
function ReportRow({ report, navigate, primary }) {
  return (
    <div style={{ ...cardStyle(), padding: primary ? "18px 20px" : "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginLeft: primary ? 0 : 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: primary ? 40 : 32, height: primary ? 40 : 32, borderRadius: 10, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, flexShrink: 0, fontSize: primary ? 16 : 13 }}>
          <FiAward />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: primary ? 14 : 12.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {primary ? "Final Report" : (report.content?.sessionName || "Session")}
          </p>
          <p style={{ margin: 0, fontSize: primary ? 12 : 11.5, color: T.inkMuted }}>
            {report.content?.overall?.totalScore ?? 0}/{report.content?.overall?.maxScore ?? 0} · {report.content?.overall?.percent ?? 0}%
            {report.publishedAt ? ` · Published ${new Date(report.publishedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/learner-portal/reports/${report.id}`)}
        style={{ padding: primary ? "8px 16px" : "6px 12px", backgroundColor: primary ? T.accent : T.tintBg, color: primary ? "#fff" : T.accent, border: primary ? "none" : `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: primary ? 12 : 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
      >
        View Report
      </button>
    </div>
  );
}

// A graded, placement diagnostic (Developmental Stage or Learning-Area) — not a Report record at
// all (diagnostics are standalone, no course/class to key one on), so this reads straight off the
// submission/assessment pair instead of report.content, and links to the assessment's own detail
// page (which AssessmentDetailPage.jsx now also resolves diagnostic rows for) rather than a
// report id. Same visual weight as a course's final report — a diagnostic is a complete result on
// its own, not a sub-item of anything else.
function DiagnosticRow({ row, navigate }) {
  const { issue, assessment, submission } = row;
  const percent = submission.maxScore > 0 ? Math.round((submission.totalScore / submission.maxScore) * 100) : 0;
  return (
    <div style={{ ...cardStyle(), padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, flexShrink: 0, fontSize: 16 }}>
          <FiAward />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assessment.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>
            {submission.totalScore}/{submission.maxScore} · {percent}%
            {submission.gradedAt ? ` · Graded ${new Date(submission.gradedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/learner-portal/assessments/${issue.id}`)}
        style={{ padding: "8px 16px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
      >
        View Report
      </button>
    </div>
  );
}

// Shared between the standalone Reports page and the Profile page's Reports tab, same pattern
// as AssessmentsOverview being reused in both places. `hubId` scopes the list to the hub the
// portal switcher is on, matching every other surface here (courses, competencies, assessments).
export default function ReportsOverview({ limit, hubId } = {}) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyReports(hubId);
  const rows = data?.data || [];

  // Diagnostics never become Report records (they're standalone — no course/class to key one on),
  // but a graded one is just as much a "report" to a learner as anything else here, and the user
  // asked for it to show up the same way. Reused straight from the same hooks the first-login
  // gate already uses to find them; filtered to graded+published, same gate FirstLoginDiagnosticGate
  // itself waits on.
  const { learner, cls } = useOutletContext() || {};
  const { data: stageRow, isLoading: stageLoading } = useDiagnosticForLearner(learner?.id, cls?.curriculumId);
  const { data: areaRows = [], isLoading: areaLoading } = useLearningAreaDiagnosticsForLearner(learner?.id);
  const diagnosticRows = [stageRow, ...areaRows]
    .filter(Boolean)
    .filter((row) => row.submission.status === "graded" && row.submission.reportPublished);

  // Group both tiers together under their course — rows arrive sorted most-recently-updated
  // first (see ReportModel.findAll), so the first report seen for a course also fixes that
  // group's position, keeping the most active course at the top.
  const groups = [];
  const groupByCourse = new Map();
  rows.forEach((report) => {
    const courseId = report.courseId;
    let group = groupByCourse.get(courseId);
    if (!group) {
      group = { courseId, courseName: report.content?.courseName || "Course", sessionReports: [], finalReport: null };
      groupByCourse.set(courseId, group);
      groups.push(group);
    }
    if (report.sessionId) group.sessionReports.push(report);
    else group.finalReport = report;
  });
  groups.forEach((g) => g.sessionReports.sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0)));

  // The diagnostics section counts as one slot toward `limit`, same as a single course group —
  // shown first since a diagnostic is chronologically the learner's very first result.
  const hasDiagnostics = diagnosticRows.length > 0;
  const visibleGroups = limit ? groups.slice(0, Math.max(0, limit - (hasDiagnostics ? 1 : 0))) : groups;
  const combinedCount = groups.length + (hasDiagnostics ? 1 : 0);

  if (isLoading || stageLoading || areaLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>;
  }

  // Kept distinct from the "No reports yet" empty state below — a failed request otherwise tells
  // the learner their teacher hasn't published anything, which may simply be untrue.
  if (isError) {
    return (
      <div style={{ ...cardStyle(), padding: "16px 18px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#B91C1C", fontSize: 13 }}>
        Couldn't load your reports — try refreshing the page.
      </div>
    );
  }

  if (rows.length === 0 && !hasDiagnostics) {
    return (
      <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: T.accent, fontSize: 24 }}><FiFileText /></div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No reports yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>A report publishes automatically for each session as its assessments are graded, with a full course report following once every session is done.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {hasDiagnostics && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: "0 0 2px", fontSize: 12.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.04em" }}>Diagnostics</p>
            {diagnosticRows.map((row) => <DiagnosticRow key={row.issue.id} row={row} navigate={navigate} />)}
          </div>
        )}
        {visibleGroups.map((group) => (
          <div key={group.courseId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: "0 0 2px", fontSize: 12.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.04em" }}>{group.courseName}</p>
            {group.sessionReports.map((report) => <ReportRow key={report.id} report={report} navigate={navigate} primary={false} />)}
            {group.finalReport && <ReportRow report={group.finalReport} navigate={navigate} primary />}
          </div>
        ))}
      </div>

      {limit && combinedCount > limit && (
        <button
          type="button"
          onClick={() => navigate("/learner-portal/reports")}
          style={{ alignSelf: "center", padding: "10px 18px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
        >
          View all {rows.length + diagnosticRows.length} reports
        </button>
      )}
    </div>
  );
}
