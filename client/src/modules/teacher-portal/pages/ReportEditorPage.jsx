import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useReport, useUpdateRemarks, usePublishReport, useUnpublishReport } from "../../reports/hooks/useReports";
import { useLearnerQuery } from "../../learners/hooks/useLearners";
import { useCourseQuery } from "../../courses/hooks/useCourse";
import ReportDetailSections from "../../reports/components/ReportDetailSections";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const fieldStyle = { boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink, outline: "none" };

export default function ReportEditorPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { data: report, isLoading, isError } = useReport(reportId);
  // Whose report this is, and for which course — without these the teacher is reviewing and
  // publishing a page headed only "Course Report", with no way to tell one learner's from another's.
  const { data: learner } = useLearnerQuery(report?.learnerId);
  const { data: course } = useCourseQuery(report?.courseId);
  const { mutate: saveRemarks, isPending: savingRemarks } = useUpdateRemarks();
  const { mutate: publish, isPending: publishing } = usePublishReport();
  const { mutate: unpublish, isPending: unpublishing } = useUnpublishReport();
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (report) setRemarks(report.remarks || "");
  }, [report]);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  // Separated from the not-found case below — a failed request otherwise reads as "this report
  // doesn't exist", sending a teacher looking for a data problem instead of retrying.
  if (isError) {
    return <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#B91C1C" }}>Couldn't load this report — try refreshing the page.</div>;
  }
  if (!report) {
    return <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Report not found.</div>;
  }

  const content = report.content || {};
  const overall = content.overall || { totalScore: 0, maxScore: 0, percent: 0 };
  const isPublished = report.status === "published";

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={() => navigate("/teacher-portal/reports")} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 20, color: T.inkMuted, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        ← Course Reports
      </button>

      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: "#fff" }}>
            {learner ? `${learner.firstName} ${learner.lastName}` : "Course Report"}
          </h1>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
            {report.sessionId ? `Session Report — ${content.sessionName || "Session"}` : (content.courseName || course?.name || "Course report")}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            {overall.totalScore}/{overall.maxScore} overall · {overall.percent}% · {isPublished ? "Published" : "Draft — not yet visible to the learner"}
          </p>
        </div>
      </div>

      {!isPublished && (
        <div style={{ padding: "12px 18px", backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 12, fontSize: 12.5, color: "#92400E", fontWeight: 600 }}>
          This is still a draft — the learner and guardian can't see it until you publish it below.
        </div>
      )}

      <div style={{ ...cardStyle, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Remarks</p>
          {isPublished ? (
            // Published reports are locked (see updateRemarks in report.service.js) — the
            // learner/guardian's permanent record shouldn't change silently after the fact. A
            // teacher who needs to correct it withdraws to draft first, which re-opens editing.
            <div style={{ padding: "10px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: report.remarks ? T.ink : T.inkFaint, fontStyle: report.remarks ? "normal" : "italic" }}>
                {report.remarks || "No remarks added."}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: T.inkFaint }}>Locked — withdraw to draft to change this.</p>
            </div>
          ) : (
            <>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="A note for the learner and guardian about this course overall…"
                style={{ ...fieldStyle, width: "100%", minHeight: 90, resize: "vertical" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => saveRemarks({ id: report.id, remarks })}
                  disabled={savingRemarks || remarks === (report.remarks || "")}
                  style={{ padding: "9px 16px", backgroundColor: "#fff", color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: savingRemarks ? "not-allowed" : "pointer" }}
                >
                  {savingRemarks ? "Saving…" : "Save Draft"}
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingTop: 6, borderTop: `1px solid ${T.border}` }}>
          {isPublished ? (
            // Publishing used to be one-way: a report sent to the wrong learner, or one whose
            // scores turned out to need re-grading, could never be taken back. Withdrawing
            // returns it to draft (hidden from the learner again, remarks editable again) while
            // keeping its remarks and history; re-publishing afterwards re-snapshots the scores.
            <button
              type="button"
              onClick={() => unpublish(report.id)}
              disabled={unpublishing}
              style={{ padding: "10px 22px", backgroundColor: "#fff", color: "#B45309", border: "1.5px solid #FDE68A", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: unpublishing ? "not-allowed" : "pointer" }}
            >
              {unpublishing ? "Withdrawing…" : "Withdraw to Draft"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => publish(report.id, { onSuccess: () => navigate("/teacher-portal/reports") })}
              disabled={publishing}
              style={{ padding: "10px 22px", backgroundColor: publishing ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: publishing ? "not-allowed" : "pointer" }}
            >
              {publishing ? "Publishing…" : "Publish Report"}
            </button>
          )}
        </div>
      </div>

      <ReportDetailSections content={content} />
    </div>
  );
}
