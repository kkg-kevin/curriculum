import { useNavigate, useParams } from "react-router-dom";
import { FiAward } from "react-icons/fi";
import { useReport } from "../../reports/hooks/useReports";
import { useCourseQuery } from "../../courses/hooks/useCourse";

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

      {content.sessionReports?.length > 0 && (
        <div style={{ ...cardStyle, padding: "16px 20px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Built from {content.sessionReports.length} session{content.sessionReports.length === 1 ? "" : "s"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {content.sessionReports.map((item) => (
              <div key={item.sessionId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{item.sessionTitle || "Untitled session"}</p>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: item.percent >= 60 ? "#059669" : "#DC2626" }}>{item.totalScore}/{item.maxScore} · {item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...cardStyle, padding: "16px 20px" }}>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Assessments</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {assessments.map((item) => (
            <div key={item.assessmentId} style={{ padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
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
                      {item.gradedAt ? new Date(item.gradedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {content.competencyScores?.length > 0 && (
        <div style={{ ...cardStyle, padding: "16px 20px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Competency Standing</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {content.competencyScores.map((cs) => (
              <div key={cs.competencyId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
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
            ))}
          </div>
        </div>
      )}

      {content.indicatorBreakdown?.length > 0 && (
        <div style={{ ...cardStyle, padding: "16px 20px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Competency Breakdown</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {content.indicatorBreakdown.map((ind) => (
              <div key={ind.indicatorId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.ink }}>{ind.indicatorName}</p>
                  <p style={{ margin: 0, fontSize: 11, color: T.inkFaint }}>{ind.competencyName}</p>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: ind.percent >= 60 ? "#059669" : "#DC2626", whiteSpace: "nowrap" }}>
                  {ind.marksEarned}/{ind.marksPossible} · {ind.percent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
