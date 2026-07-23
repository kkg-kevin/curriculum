import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiCheckCircle, FiClock, FiSend } from "react-icons/fi";
import { useIssuedForLearner, useStartSubmission, useSaveDraft, useSubmitAssessment } from "../../assessments/hooks/useAssessmentSubmission";
import { normalizeLegacyItem, entryMarks } from "../../assessments/schemas/assessment.schema";
import AssessmentTaker from "../../assessments/components/AssessmentTaker";
import RichContent from "../../assessments/components/RichContent";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const AUTO_GRADABLE_KINDS = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank"];

function formatResponse(response) {
  if (response == null || response === "") return <em style={{ color: T.inkFaint }}>No answer given</em>;
  if (Array.isArray(response)) {
    if (response.length && typeof response[0] === "object") return response.map((p) => `${p.left} → ${p.right}`).join(", ");
    return response.join(", ");
  }
  return String(response);
}

function FeedbackRow({ index, item, response, autoResult, feedback }) {
  const isAuto = AUTO_GRADABLE_KINDS.includes(item.kind);
  const marks = isAuto ? (autoResult?.marksAwarded ?? 0) : (feedback?.marks ?? 0);
  const max = isAuto ? (autoResult?.maxMarks ?? entryMarks(item)) : entryMarks(item);
  const good = isAuto ? !!autoResult?.correct : marks >= max * 0.6;

  return (
    <div style={{ padding: "14px 16px", backgroundColor: good ? "#F7FEFB" : "#FFFBFA", border: `1px solid ${good ? "#D1FAE5" : "#FEE2E2"}`, borderRadius: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{index + 1}.</span>
        <div style={{ flex: 1, fontSize: 13 }}><RichContent html={item.question} /></div>
        <span style={{ fontSize: 11, fontWeight: 700, color: good ? "#059669" : "#DC2626", whiteSpace: "nowrap" }}>{marks}/{max}</span>
      </div>
      <p style={{ margin: "0 0 0 20px", fontSize: 12.5, color: T.inkMuted }}>Your answer: {formatResponse(response)}</p>
      {feedback?.comment && <p style={{ margin: "6px 0 0 20px", fontSize: 12.5, color: T.accent, fontStyle: "italic" }}>"{feedback.comment}"</p>}
    </div>
  );
}

export default function AssessmentDetailPage() {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useIssuedForLearner();
  const row = (data?.data || []).find((r) => r.issue.id === issueId);

  const { mutate: startSubmission, isPending: starting } = useStartSubmission();
  const { mutate: saveDraft, isPending: saving } = useSaveDraft();
  const { mutate: submitAssessment, isPending: submitting } = useSubmitAssessment();

  const [activeSubmission, setActiveSubmission] = useState(null);
  const [draftAnswers, setDraftAnswers] = useState(null);

  useEffect(() => {
    if (row?.submission?.id && !activeSubmission) setActiveSubmission(row.submission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.submission?.id]);

  const submission = activeSubmission || row?.submission;
  const items = useMemo(() => (row?.assessment?.items || []).map(normalizeLegacyItem), [row?.assessment?.items]);
  const rubric = row?.assessment?.rubric || [];
  const autoByItem = useMemo(() => new Map((submission?.autoItemResults || []).map((r) => [r.itemId, r])), [submission?.autoItemResults]);
  const feedbackByKey = useMemo(() => new Map((submission?.itemFeedback || []).map((f) => [f.itemId, f])), [submission?.itemFeedback]);
  const answersByItem = useMemo(() => new Map((submission?.answers || []).map((a) => [a.itemId, a.response])), [submission?.answers]);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!row) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Assessment not found.</div>;
  }

  const { assessment } = row;

  const handleStart = () => {
    startSubmission(issueId, { onSuccess: (sub) => setActiveSubmission(sub) });
  };
  const handleSaveDraft = () => saveDraft({ id: submission.id, answers: draftAnswers || submission.answers || [] });
  const handleSubmit = () => submitAssessment({ id: submission.id, answers: draftAnswers || submission.answers || [] }, {
    onSuccess: (sub) => setActiveSubmission(sub),
  });

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={() => navigate("/learner-portal/assessments")} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 20, color: T.inkMuted, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        ← My Assessments
      </button>

      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#fff" }}>{assessment.name}</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{stripDescription(assessment.description)}</p>
        </div>
      </div>

      {!submission || submission.status === "not_started" ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: T.accent, fontSize: 24 }}><FiSend /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>Ready when you are</h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: T.inkMuted, maxWidth: 420, marginInline: "auto" }}>
            {items.length > 0 ? `${items.length} question${items.length === 1 ? "" : "s"}. ` : ""}You can save your progress and come back before submitting.
          </p>
          <button type="button" onClick={handleStart} disabled={starting} style={{ padding: "12px 28px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: starting ? "not-allowed" : "pointer" }}>
            {starting ? "Starting…" : "Start Assessment"}
          </button>
        </div>
      ) : submission.status === "in_progress" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <AssessmentTaker assessment={assessment} initialAnswers={submission.answers} onChange={setDraftAnswers} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={handleSaveDraft} disabled={saving} style={{ padding: "10px 20px", backgroundColor: "#fff", color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting} style={{ padding: "10px 24px", backgroundColor: submitting ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: submitting ? "not-allowed" : "pointer" }}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      ) : submission.status === "submitted" ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: "#B45309", fontSize: 24 }}><FiClock /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>Submitted — awaiting grading</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>
            Submitted {new Date(submission.submittedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}. Your teacher will grade it soon.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cardStyle, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669", fontSize: 22, flexShrink: 0 }}><FiCheckCircle /></div>
            <div>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#059669" }}>{submission.totalScore} / {submission.maxScore}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>
                {submission.maxScore ? `${Math.round((submission.totalScore / submission.maxScore) * 100)}%` : ""} · Graded {new Date(submission.gradedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          {submission.overallFeedback && (
            <div style={{ ...cardStyle, padding: "16px 20px", backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}` }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tech Educator Feedback</p>
              <p style={{ margin: 0, fontSize: 13.5, color: T.ink }}>{submission.overallFeedback}</p>
            </div>
          )}

          {items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item, i) => (
                <FeedbackRow
                  key={item.id}
                  index={i}
                  item={item}
                  response={answersByItem.get(item.id)}
                  autoResult={autoByItem.get(item.id)}
                  feedback={feedbackByKey.get(item.id)}
                />
              ))}
            </div>
          )}

          {rubric.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rubric</p>
              {rubric.map((c) => {
                const fb = feedbackByKey.get(`rubric:${c.id}`);
                const max = entryMarks(c);
                return (
                  <div key={c.id} style={{ padding: "12px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{c.criterion}</p>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, whiteSpace: "nowrap" }}>{fb?.marks ?? 0}/{max}</span>
                    </div>
                    {fb?.comment && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.accent, fontStyle: "italic" }}>"{fb.comment}"</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function stripDescription(html) {
  if (!html) return "Review your grade and feedback once your teacher has graded this.";
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || "Review your grade and feedback once your teacher has graded this.";
}
