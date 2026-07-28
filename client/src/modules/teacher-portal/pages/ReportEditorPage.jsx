import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useReport, useUpdateRemarks, usePublishReport } from "../../reports/hooks/useReports";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const fieldStyle = { boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink, outline: "none" };

function ScoreRow({ item }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{item.name}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>{item.gradedAt ? new Date(item.gradedAt).toLocaleDateString("en-KE", { dateStyle: "medium" }) : ""}</p>
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.accent }}>{item.totalScore}/{item.maxScore} · {item.percent}%</p>
    </div>
  );
}

function IndicatorRow({ ind }) {
  return (
    <div style={{ padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink }}>{ind.indicatorName}</p>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.accent }}>{ind.marksEarned}/{ind.marksPossible} · {ind.percent}%</p>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: T.inkFaint }}>{ind.competencyName}</p>
    </div>
  );
}

export default function ReportEditorPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { data: report, isLoading } = useReport(reportId);
  const { mutate: saveRemarks, isPending: savingRemarks } = useUpdateRemarks();
  const { mutate: publish, isPending: publishing } = usePublishReport();
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (report) setRemarks(report.remarks || "");
  }, [report]);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!report) {
    return <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Report not found.</div>;
  }

  const { content } = report;
  const isPublished = report.status === "published";

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={() => navigate("/teacher-portal/reports")} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 20, color: T.inkMuted, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        ← Course Reports
      </button>

      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#fff" }}>Course Report</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            {content.overall.totalScore}/{content.overall.maxScore} overall · {content.overall.percent}% · {isPublished ? "Published" : "Draft — not yet visible to the learner"}
          </p>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Assessments</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {content.assessments.map((item) => <ScoreRow key={item.assessmentId} item={item} />)}
          </div>
        </div>

        {content.indicatorBreakdown.length > 0 && (
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Competency Breakdown</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {content.indicatorBreakdown.map((ind) => <IndicatorRow key={ind.indicatorId} ind={ind} />)}
            </div>
          </div>
        )}

        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Remarks</p>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="A note for the learner and guardian about this course overall…"
            style={{ ...fieldStyle, width: "100%", minHeight: 90, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, paddingTop: 6, borderTop: `1px solid ${T.border}` }}>
          <button
            type="button"
            onClick={() => saveRemarks({ id: report.id, remarks })}
            disabled={savingRemarks || remarks === (report.remarks || "")}
            style={{ padding: "10px 18px", backgroundColor: "#fff", color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: savingRemarks ? "not-allowed" : "pointer" }}
          >
            {savingRemarks ? "Saving…" : "Save Remarks"}
          </button>
          {!isPublished && (
            <button
              type="button"
              onClick={() => publish(report.id)}
              disabled={publishing}
              style={{ padding: "10px 22px", backgroundColor: publishing ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: publishing ? "not-allowed" : "pointer" }}
            >
              {publishing ? "Publishing…" : "Publish Report"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
