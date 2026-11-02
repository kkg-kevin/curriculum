import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiCheckCircle, FiClipboard } from "react-icons/fi";
import { useIssuedForLearner } from "../../assessments/hooks/useAssessmentSubmission";
import RichContent, { isEmptyHtml } from "../../assessments/components/RichContent";
import { TYPE_LABELS } from "../../assessments/components/AssessmentContent";

const STATUS = {
  graded: { label: "Marked", color: "#047857" },
  submitted: { label: "Submitted — waiting to be marked", color: "#2e7db5" },
  in_progress: { label: "Started", color: "#B45309" },
};

// An assessment in a course session's Assessments tab, as the learner (or a parent watching) sees
// it: what it is and the way to it — never the questions and answers, which staff see here
// (AssessmentContent). Taking it, and reading the results once marked, happens on the learner's
// own assessment page, found through the issue made for this session.
export default function LearnerSessionAssessment({ assessment, sessionId }) {
  const navigate = useNavigate();
  const { data, isLoading } = useIssuedForLearner();
  const rows = (data?.data || []).filter((r) => r.assessment?.id === assessment.id);
  const row = rows.find((r) => r.issue?.sessionId === sessionId) || rows[0];
  const status = STATUS[row?.submission?.status];
  const questions = (assessment.items || []).length;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#E8F5FB", color: "#25476a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FiClipboard size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>{assessment.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6B7280" }}>
            {TYPE_LABELS[assessment.type] || "Assessment"}{questions ? ` · ${questions} question${questions === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        {status && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: status.color }}>
            <FiCheckCircle size={13} /> {status.label}
          </span>
        )}
      </div>

      {!isEmptyHtml(assessment.description) && <RichContent html={assessment.description} />}
      {!isEmptyHtml(assessment.instructions) && (
        <div style={{ padding: "12px 16px", borderRadius: 12, backgroundColor: "#F8FAFF", border: "1px solid #E5E7EB" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.06em" }}>Instructions</p>
          <RichContent html={assessment.instructions} />
        </div>
      )}

      <div>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => navigate(row ? `/learner-portal/assessments/${row.issue.id}` : "/learner-portal/assessments")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", backgroundColor: "#25476a", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isLoading ? "wait" : "pointer" }}
        >
          {row?.submission?.status === "graded" ? "See my results" : row?.submission?.status === "submitted" ? "View my answers" : row?.submission ? "Continue" : "Open assessment"} <FiArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
