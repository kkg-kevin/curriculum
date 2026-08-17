import { useNavigate, useParams } from "react-router-dom";
import { FiAward } from "react-icons/fi";
import { useReport } from "../../reports/hooks/useReports";
import { useCourseQuery } from "../../courses/hooks/useCourse";
import ReportDetailSections from "../../reports/components/ReportDetailSections";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

export default function ReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { data: report, isLoading, isError } = useReport(reportId);
  // Only used as a fallback for reports generated before courseName was snapshotted into content.
  const { data: course } = useCourseQuery(report?.content?.courseName ? null : report?.courseId);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  // Distinct from not-found — a network/server failure shouldn't tell a learner their report
  // doesn't exist when it does.
  if (isError) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#B91C1C" }}>Couldn't load this report — try refreshing the page.</div>;
  }
  if (!report) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Report not found.</div>;
  }

  const content = report.content || {};
  const overall = content.overall || { totalScore: 0, maxScore: 0, percent: 0 };
  const assessments = content.assessments || [];

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={() => navigate("/learner-portal/reports")} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 20, color: T.inkMuted, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        ← My Reports
      </button>

      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#fff" }}>
            {report.sessionId ? `Session Report — ${content.sessionName || "Session"}` : (content.courseName || course?.name || "Course Report")}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            Published {report.publishedAt ? new Date(report.publishedAt).toLocaleDateString("en-KE", { dateStyle: "medium" }) : ""}
          </p>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669", fontSize: 22, flexShrink: 0 }}><FiAward /></div>
        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#059669" }}>{overall.totalScore} / {overall.maxScore}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>{overall.percent}% overall across {assessments.length} assessment{assessments.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {report.remarks && (
        <div style={{ ...cardStyle, padding: "16px 20px", backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}` }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Educator Remarks</p>
          <p style={{ margin: 0, fontSize: 13.5, color: T.ink }}>{report.remarks}</p>
        </div>
      )}

      <ReportDetailSections content={content} />
    </div>
  );
}
