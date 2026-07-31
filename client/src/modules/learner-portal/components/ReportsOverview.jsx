import { useNavigate } from "react-router-dom";
import { FiAward, FiFileText } from "react-icons/fi";
import { useMyReports } from "../../reports/hooks/useReports";
import { T, cardStyle } from "./profile/theme";

// Shared between the standalone Reports page and the Profile page's Reports tab, same pattern
// as AssessmentsOverview being reused in both places. `hubId` scopes the list to the hub the
// portal switcher is on, matching every other surface here (courses, competencies, assessments).
export default function ReportsOverview({ limit, hubId } = {}) {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyReports(hubId);
  const rows = data?.data || [];
  const visibleRows = limit ? rows.slice(0, limit) : rows;

  if (isLoading) {
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

  if (rows.length === 0) {
    return (
      <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: T.accent, fontSize: 24 }}><FiFileText /></div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No reports yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Your teacher publishes a report once every assessment in a course has been graded.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>
        {visibleRows.map((report) => (
          <div key={report.id} style={{ ...cardStyle(), padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, flexShrink: 0 }}>
                <FiAward />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {report.content?.courseName || "Course"}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>
                  {report.content?.overall?.totalScore ?? 0}/{report.content?.overall?.maxScore ?? 0} · {report.content?.overall?.percent ?? 0}%
                  {report.publishedAt ? ` · Published ${new Date(report.publishedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/learner-portal/reports/${report.id}`)}
              style={{ padding: "8px 16px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              View Report
            </button>
          </div>
        ))}
      </div>

      {limit && rows.length > limit && (
        <button
          type="button"
          onClick={() => navigate("/learner-portal/reports")}
          style={{ alignSelf: "center", padding: "10px 18px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
        >
          View all {rows.length} reports
        </button>
      )}
    </div>
  );
}
