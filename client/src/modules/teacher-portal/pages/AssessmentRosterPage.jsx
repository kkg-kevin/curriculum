import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRosterForIssue, useGradeSubmission } from "../../assessments/hooks/useAssessmentSubmission";
import GradingPanel from "../../assessments/components/GradingPanel";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

const STATUS_CONFIG = {
  not_started: { label: "Not Started", bg: "#F9FAFB", color: T.inkMuted, border: T.border },
  in_progress: { label: "In Progress", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  submitted:   { label: "Needs Grading", bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  graded:      { label: "Graded", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1.5px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

export default function AssessmentRosterPage() {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useRosterForIssue(issueId);
  const { mutate: grade, isPending: saving } = useGradeSubmission();
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!data) {
    return <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Assessment issue not found.</div>;
  }

  const { assessment, roster } = data;
  const selectedRow = roster.find((r) => r.learner.id === selectedLearnerId) || null;
  const submitted = roster.filter((r) => r.submission.status !== "not_started" && r.submission.status !== "in_progress").length;
  const gradedCount = roster.filter((r) => r.submission.status === "graded").length;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={() => navigate("/teacher-portal/assessments")} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 20, color: T.inkMuted, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        ← My Assessments
      </button>

      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#fff" }}>{assessment.name}</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{submitted} of {roster.length} submitted · {gradedCount} graded</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Roster</p>
          </div>
          {roster.length === 0 ? (
            <p style={{ margin: 0, padding: "24px 16px", fontSize: 13, color: T.inkFaint, textAlign: "center" }}>No learners in this class yet.</p>
          ) : (
            roster.map(({ learner, submission }) => {
              const active = learner.id === selectedLearnerId;
              return (
                <button
                  key={learner.id}
                  type="button"
                  onClick={() => setSelectedLearnerId(learner.id)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", border: "none", borderBottom: `1px solid #F9FAFB`, backgroundColor: active ? T.tintBg : "transparent", cursor: "pointer" }}
                >
                  <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: active ? T.accent : T.ink }}>{learner.firstName} {learner.lastName}</p>
                  <StatusBadge status={submission.status} />
                  {submission.status === "graded" && (
                    <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: T.accent }}>{submission.totalScore}/{submission.maxScore}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div style={{ ...cardStyle, padding: "20px 22px", minHeight: 300 }}>
          {!selectedRow ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: T.inkFaint, fontSize: 13.5 }}>Select a learner from the roster to view or grade their submission.</div>
          ) : selectedRow.submission.status === "not_started" || selectedRow.submission.status === "in_progress" ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: T.ink }}>{selectedRow.learner.firstName} {selectedRow.learner.lastName} hasn't submitted yet</h3>
              <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>{selectedRow.submission.status === "in_progress" ? "They've started but not submitted." : "Nothing to grade until they submit."}</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: T.ink }}>{selectedRow.learner.firstName} {selectedRow.learner.lastName}</h2>
                <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>
                  Submitted {new Date(selectedRow.submission.submittedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <GradingPanel
                assessment={assessment}
                submission={selectedRow.submission}
                isSaving={saving}
                onSave={(payload) => grade({ id: selectedRow.submission.id, ...payload })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
