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
  // A Teacher Observation isn't the learner's to do: their teacher records it in class, and it
  // reaches them (on their list too) only once submitted — then it reads as feedback.
  const observation = assessment.type === "observation";
  const observed = observation && row?.submission?.status === "graded";
  const shownStatus = observed ? { label: "Feedback ready", color: "#047857" } : status;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#E8F5FB", color: "#25476a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FiClipboard size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>{assessment.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6B7280" }}>
            {TYPE_LABELS[assessment.type] || "Assessment"}{!observation && questions ? ` · ${questions} question${questions === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        {shownStatus && (!observation || observed) && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: shownStatus.color }}>
            <FiCheckCircle size={13} /> {shownStatus.label}
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

      {observation && !observed ? (
        <p style={{ margin: 0, padding: "12px 16px", borderRadius: 12, backgroundColor: "#F8FAFF", border: "1px solid #E5E7EB", fontSize: 13.5, color: "#374151", lineHeight: 1.5 }}>
          Your teacher watches how you work in this session and writes it up. There&apos;s nothing for you to do — their feedback appears here and in your reports once they send it.
        </p>
      ) : (
      <div>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => navigate(row ? `/learner-portal/assessments/${row.issue.id}` : "/learner-portal/assessments")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", backgroundColor: "#25476a", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isLoading ? "wait" : "pointer" }}
        >
          {observed ? "Read my teacher's feedback" : row?.submission?.status === "graded" ? "See my results" : row?.submission?.status === "submitted" ? "View my answers" : row?.submission ? "Continue" : "Open assessment"} <FiArrowRight size={15} />
        </button>
      </div>
      )}
    </div>
  );
}
