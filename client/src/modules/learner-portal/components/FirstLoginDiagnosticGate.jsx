import { useEffect, useRef, useState } from "react";
import { FiActivity, FiSend } from "react-icons/fi";
import { useLearningAreas } from "../../curriculum/hooks/useCompetencies";
import { useLearningAreaDiagnosticsForLearner, useStartSubmission, useSaveDraft, useSubmitAssessment } from "../../assessments/hooks/useAssessmentSubmission";
import AssessmentTaker from "../../assessments/components/AssessmentTaker";
import { useEnsureDiagnosticsIssued, useMarkPortalOnboardingComplete } from "../hooks/usePortalOnboarding";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB", tintBg: "#e8f5fb", tintBorder: "#a8d5ee" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

function isOutstanding(row) {
  return row.submission.status === "not_started" || row.submission.status === "in_progress";
}

function LoadingState() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontFamily: "Inter, sans-serif", gap: 12, color: T.inkMuted, fontSize: 14 }}>
      <span style={{ width: 22, height: 22, border: `3px solid ${T.border}`, borderTopColor: T.accent, borderRadius: "50%", display: "inline-block", animation: "fldg-spin 0.7s linear infinite" }} />
      <style>{"@keyframes fldg-spin { to { transform: rotate(360deg); } }"}</style>
      Preparing your welcome diagnostic…
    </div>
  );
}

// One outstanding diagnostic's start/answer/submit flow, trimmed from the full learner-portal
// AssessmentDetailPage (no "submitted"/"graded" review view needed here — the moment a step
// leaves not_started/in_progress it drops out of the gate's outstanding list on its own, via
// useSubmitAssessment's diagnostic-query invalidation). Keyed by issue.id at the call site so
// remounting between steps resets local state for free instead of manual bookkeeping.
function DiagnosticStep({ row, index, total, learningAreaName, onDone }) {
  const { issue, assessment, submission: initialSubmission } = row;
  const [activeSubmission, setActiveSubmission] = useState(initialSubmission.id ? initialSubmission : null);
  const [draftAnswers, setDraftAnswers] = useState(null);

  const { mutate: startSubmission, isPending: starting } = useStartSubmission();
  const { mutate: saveDraft, isPending: saving } = useSaveDraft();
  const { mutate: submitAssessment, isPending: submitting } = useSubmitAssessment();

  const submission = activeSubmission || initialSubmission;

  const handleStart = () => startSubmission(issue.id, { onSuccess: setActiveSubmission });
  const handleSaveDraft = () => saveDraft({ id: submission.id, answers: draftAnswers || submission.answers || [] });
  const handleSubmit = () => submitAssessment({ id: submission.id, answers: draftAnswers || submission.answers || [] }, { onSuccess: onDone });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 720, marginInline: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.accent, backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}`, borderRadius: 20, padding: "3px 11px" }}>
          Diagnostic {index + 1} of {total}
        </span>
        {learningAreaName && <span style={{ fontSize: 12.5, fontWeight: 600, color: T.inkMuted }}>{learningAreaName}</span>}
      </div>

      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "22px 26px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "#fff" }}>{assessment.name}</h1>
        <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.72)" }}>
          A quick check so we can place you at the right starting point.
        </p>
      </div>

      {!submission || submission.status === "not_started" ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: T.accent, fontSize: 22 }}><FiSend /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: T.ink }}>Ready when you are</h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: T.inkMuted }}>You can save your progress and come back before submitting.</p>
          <button type="button" onClick={handleStart} disabled={starting} style={{ padding: "11px 26px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: starting ? "not-allowed" : "pointer" }}>
            {starting ? "Starting…" : "Start Diagnostic"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <AssessmentTaker assessment={assessment} initialAnswers={submission.answers} onChange={setDraftAnswers} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={handleSaveDraft} disabled={saving} style={{ padding: "10px 20px", backgroundColor: "#fff", color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting} style={{ padding: "10px 24px", backgroundColor: submitting ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: submitting ? "not-allowed" : "pointer" }}>
              {submitting ? "Submitting…" : total > index + 1 ? "Submit & Continue" : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Blocks the rest of the learner-portal behind this until every Learning-Area diagnostic the
// learner's current hub/curriculum owes them is submitted — the very first thing a learner sees
// on their first portal visit, per the product decision this was built for. Only ever active
// while learner.portalOnboardingCompletedAt is unset; once cleared (here, either by finishing
// every diagnostic or by there being none to take), it never reappears for this learner again.
export default function FirstLoginDiagnosticGate({ learner, hub, cls, onComplete = () => {} }) {
  const hasEnsured = useRef(false);
  const [ensured, setEnsured] = useState(false);
  const totalRef = useRef(null);

  const { mutate: ensureIssued } = useEnsureDiagnosticsIssued();
  const { mutate: markComplete, isPending: completing } = useMarkPortalOnboardingComplete();
  const { data: rowsData, isLoading: rowsLoading, refetch } = useLearningAreaDiagnosticsForLearner(learner.id);
  const { data: areas = [] } = useLearningAreas(cls?.curriculumId);
  const areaNameById = new Map(areas.map((a) => [a.id, a.name]));

  // Runs once per gate mount — if learner has no class yet, or hub/curriculum not set up,
  // just mark ensured=true so the gate releases immediately. Otherwise ensure diagnostics are issued.
  useEffect(() => {
    if (hasEnsured.current) return;
    hasEnsured.current = true;
    if (!hub?.id) { setEnsured(true); return; }
    if (!cls?.id) { setEnsured(true); return; } // No class assigned yet — skip diagnostics
    ensureIssued({ learnerId: learner.id, hubId: hub.id }, { onSettled: () => { setEnsured(true); refetch(); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = rowsData || [];
  const outstanding = rows.filter(isOutstanding);
  if (totalRef.current === null && outstanding.length > 0) totalRef.current = outstanding.length;

  // DEBUG
  console.log("FirstLoginDiagnosticGate Debug:", {
    learner: learner?.id,
    hub: hub?.id,
    cls: cls?.id,
    ensured,
    rowsLoading,
    rowsData: rows.length,
    outstanding: outstanding.length,
    areas: areas.length,
  });

  const nothingToShow = ensured && !rowsLoading && outstanding.length === 0;
  useEffect(() => {
    if (nothingToShow && !completing) markComplete(learner.id, { onSuccess: onComplete });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nothingToShow]);

  // Still loading data, or waiting for ensurance check to complete
  if (!ensured || rowsLoading) return <LoadingState />;

  // Nothing to show — markComplete effect should have already fired, layout will refresh
  // when learner record updates. Don't render anything here.
  if (nothingToShow) return null;

  const total = totalRef.current || outstanding.length;
  const doneCount = total - outstanding.length;
  const current = outstanding[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 4px 40px", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 560, marginInline: "auto" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", color: T.accent, fontSize: 20 }}><FiActivity /></div>
        <h1 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: T.ink }}>Welcome, {learner.firstName}!</h1>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>
          Before you get started, complete {total > 1 ? "these quick diagnostics" : "this quick diagnostic"} so we know where to place you.
        </p>
      </div>

      <DiagnosticStep
        key={current.issue.id}
        row={current}
        index={doneCount}
        total={total}
        learningAreaName={areaNameById.get(current.issue.learningAreaId)}
        onDone={() => refetch()}
      />
    </div>
  );
}
