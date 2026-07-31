import { useCallback, useEffect, useRef, useState } from "react";
import { FiActivity, FiSend } from "react-icons/fi";
import { useLearningAreas, useAgeCategories } from "../../curriculum/hooks/useCompetencies";
import { useLearningAreaDiagnosticsForLearner, useDiagnosticForLearner, useStartSubmission, useSaveDraft, useSubmitAssessment } from "../../assessments/hooks/useAssessmentSubmission";
import AssessmentTaker from "../../assessments/components/AssessmentTaker";
import { useEnsureDiagnosticsIssued, useMarkHubOnboardingComplete } from "../hooks/usePortalOnboarding";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB", tintBg: "#e8f5fb", tintBorder: "#a8d5ee" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

// A diagnostic only actually releases the gate once it's graded — "submitted" still blocks
// (see the exported component's doc comment for why), it's just not something the learner has
// any further action to take on.
function isGraded(row) {
  return row.submission.status === "graded";
}

function needsLearnerAction(row) {
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

// Shown once every remaining diagnostic has been submitted but at least one still needs a
// teacher's grade — nothing left for the learner to do, but the gate can't release yet because
// grading is what actually sets their placement (see maybePlaceFromDiagnostic). Polls in the
// background (see the exported component) so it clears itself once grading lands.
function AwaitingGradingState({ count }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 4px 40px", fontFamily: "Inter, sans-serif" }}>
      <style>{"@keyframes fldg-spin { to { transform: rotate(360deg); } }"}</style>
      <div style={{ textAlign: "center", maxWidth: 560, marginInline: "auto" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", color: T.accent, fontSize: 20 }}><FiActivity /></div>
        <h1 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: T.ink }}>Nice work!</h1>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>
          {count > 1 ? `Your ${count} diagnostics are` : "Your diagnostic is"} submitted and waiting on your teacher to grade {count > 1 ? "them" : "it"}. This page updates automatically once that's done.
        </p>
      </div>
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <span style={{ width: 22, height: 22, border: `3px solid ${T.border}`, borderTopColor: T.accent, borderRadius: "50%", display: "inline-block", animation: "fldg-spin 0.7s linear infinite" }} />
      </div>
    </div>
  );
}

// One actionable diagnostic's start/answer/submit flow, trimmed from the full learner-portal
// AssessmentDetailPage (no "submitted"/"graded" review view needed here — the moment a step
// leaves not_started/in_progress it drops out of the gate's actionable list on its own, via
// useSubmitAssessment's diagnostic-query invalidation; from there the exported component's
// AwaitingGradingState or markComplete effect takes over). Keyed by issue.id at the call site so
// remounting between steps resets local state for free instead of manual bookkeeping.
function DiagnosticStep({ row, index, total, contextLabel, onDone }) {
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
        {contextLabel && <span style={{ fontSize: 12.5, fontWeight: 600, color: T.inkMuted }}>{contextLabel}</span>}
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

// Blocks the rest of the learner-portal behind this until every diagnostic the learner's
// current hub/curriculum owes them has been GRADED — not merely submitted — whether that's
// their Developmental Stage diagnostic (age-category based, sets currentStageId/currentBandId),
// any Learning-Area diagnostics (sets a starting course per area), or both; a curriculum only
// ever configuring one of the two still reliably gates. A manually-graded diagnostic only sets
// the learner's placement (see maybePlaceFromDiagnostic in assessment-submission.service.js)
// once a teacher grades it, so releasing the gate on submit alone would let a learner into a
// portal whose placement hasn't landed yet. This is the very first thing a learner sees the
// first time they visit a given hub's portal, per the product decision this was built for. Only
// ever active while the CURRENTLY SELECTED hub's onboardingCompletedAt (see LearnerPortalLayout's
// gateActive, LearnerHubLinkModel) is unset; once cleared (here, once every diagnostic is
// graded, or there being none to take), it never reappears for that hub again — even if a new
// diagnostic is added to the curriculum later. Scoped per hub rather than per learner so a
// learner enrolled at several hubs still gets gated on a hub they haven't cleared yet, even
// after clearing another one.
export default function FirstLoginDiagnosticGate({ learner, hub, cls, onComplete = () => {} }) {
  const hasEnsured = useRef(false);
  // Covers both halves of "the one-time top-up call is done": hub/cls turning out to be
  // unresolvable (nothing to ensure) and the call itself finishing (see the effect below).
  const [ensureSettled, setEnsureSettled] = useState(false);
  const totalRef = useRef(null);

  // mutateAsync + a plain Promise chain, not the mutation's own subscribed status/onSuccess-
  // onError callbacks — both of those are bound to this hook's mutation-cache subscription,
  // which React.StrictMode's dev-only mount→cleanup→remount cycle (see main.jsx) can tear down
  // and never re-deliver a result through, even though the request itself succeeded (confirmed
  // via network + a temporary render trace: the POST landed 200, but `status` sat on "pending"
  // forever). Driving ensureSettled off the Promise itself, resolved into a plain setState,
  // sidesteps that subscription entirely.
  const { mutateAsync: ensureIssuedAsync } = useEnsureDiagnosticsIssued();
  const { mutateAsync: markCompleteAsync } = useMarkHubOnboardingComplete();
  const hasMarkedComplete = useRef(false);
  const { data: rowsData, isLoading: areaRowsLoading, refetch: refetchAreaRows } = useLearningAreaDiagnosticsForLearner(learner.id);
  // The Developmental Stage diagnostic (age-category based) — a SEPARATE mechanism from
  // Learning-Area diagnostics (sets currentStageId/currentBandId instead of a starting course),
  // that this gate previously never checked at all. A curriculum that only configures a Stage
  // diagnostic (no Learning-Area ones) would otherwise let every new learner straight into the
  // portal, unplaced, with nothing ever gating them — merged into the same pending/actionable
  // list below so either mechanism (or both) reliably blocks the gate until graded.
  const { data: stageRow, isLoading: stageRowLoading, refetch: refetchStageRow } = useDiagnosticForLearner(learner.id, cls?.curriculumId);
  const { data: areas = [], isLoading: areasLoading } = useLearningAreas(cls?.curriculumId);
  const { data: ageCategories = [] } = useAgeCategories(cls?.curriculumId);
  const areaNameById = new Map(areas.map((a) => [a.id, a.name]));
  const stageNameById = new Map(ageCategories.map((s) => [s.id, s.name]));

  // areasLoading matters here too, not just the two diagnostic queries — areaIds (below) is
  // derived from `areas`, and filters areaRows down before anything else sees them. If areas
  // resolves slower than the diagnostic queries, a render could see rowsLoading as "done" while
  // areaIds is still the pre-load empty set, silently dropping every Learning-Area diagnostic
  // for that one render — exactly enough to lock totalRef.current (below) at an undercount.
  const rowsLoading = areaRowsLoading || stageRowLoading || areasLoading;
  // Stable identity (unlike an inline arrow function) — the polling effect below depends on
  // this reference staying the same across renders, or it would tear down and restart its
  // interval on every unrelated re-render instead of actually waiting out the full 15s.
  const refetch = useCallback(() => { refetchAreaRows(); refetchStageRow(); }, [refetchAreaRows, refetchStageRow]);

  // Fires once, the first time hub/cls resolve — a best-effort top-up for any diagnostic the
  // enrollment-time write missed (see learner.service.js's ensureDiagnosticsIssued). No class
  // yet means nothing to ensure, so that path settles immediately instead of waiting forever.
  useEffect(() => {
    if (!hub?.id || !cls?.id) { setEnsureSettled(true); return; }
    if (hasEnsured.current) return;
    hasEnsured.current = true;
    ensureIssuedAsync({ learnerId: learner.id, hubId: hub.id })
      .catch(() => {})
      .finally(() => { setEnsureSettled(true); refetch(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub?.id, cls?.id]);

  // useLearningAreaDiagnosticsForLearner aggregates outstanding diagnostics across every hub
  // the learner is active at, not just this one (the admin-facing LearnerViewPage wants that
  // full picture) — filtered down here to just the areas belonging to the CURRENTLY SELECTED
  // hub's curriculum, so a learner gated for this hub only ever sees this hub's diagnostics,
  // never one left outstanding at a different hub they haven't switched to yet. The Stage
  // diagnostic is already curriculum-scoped server-side (see useDiagnosticForLearner), so it's
  // just merged straight in.
  const areaIds = new Set(areas.map((a) => a.id));
  const areaRows = (rowsData || []).filter((row) => areaIds.has(row.issue.learningAreaId));
  const rows = stageRow ? [stageRow, ...areaRows] : areaRows;
  // "pending" = still blocks the gate (not yet graded). "actionable" = the subset the learner
  // can actually do something with right now; the rest ("submitted") is waiting on a teacher.
  const pending = rows.filter((row) => !isGraded(row));
  const actionable = pending.filter(needsLearnerAction);
  const awaitingGradingCount = pending.length - actionable.length;
  // Gated on !rowsLoading (both the Stage and Learning-Area queries, not just one) — otherwise,
  // since they resolve independently, a render where only one has landed yet would lock in a
  // count that undercounts the other, permanently showing "Diagnostic 1 of 1" for a learner who
  // actually has 2 outstanding.
  if (totalRef.current === null && !rowsLoading && pending.length > 0) totalRef.current = pending.length;

  // Already have something pending to show (actionable or awaiting grading)? Render it
  // immediately — never wait on the ensure top-up once real data has arrived, so a slow/failed
  // ensure call can't stall a learner who already has a diagnostic sitting there waiting for them.
  const hasPending = !rowsLoading && pending.length > 0;

  // Only safe to conclude "nothing to show" once the ensure top-up has actually had its chance
  // to run — otherwise a brand-new enrollment (rows still empty on the very first fetch) would
  // release the gate before its diagnostic even got issued.
  const nothingToShow = ensureSettled && !rowsLoading && pending.length === 0;
  // Same StrictMode subscription hazard as ensureIssuedAsync above: driving this off mutate()'s
  // own onSuccess left a real, reproduced bug — the POST lands and the hub's
  // onboardingCompletedAt genuinely gets set server-side, but the dev-mode mount→cleanup→remount
  // cycle can tear this component down before that onSuccess (and so the cache patch that would
  // release the gate) is delivered, leaving the learner staring at this component's `return null`
  // below forever, with no error anywhere, until a manual reload happens to catch the now-true
  // server state. mutateAsync + a plain Promise chain sidesteps that subscription entirely.
  useEffect(() => {
    if (!nothingToShow || hasMarkedComplete.current || !hub?.id) return;
    hasMarkedComplete.current = true;
    markCompleteAsync({ learnerId: learner.id, hubId: hub.id })
      .then(() => onComplete())
      .catch(() => { hasMarkedComplete.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nothingToShow, hub?.id]);

  // Nothing left for the learner to act on, but at least one diagnostic is still waiting on a
  // teacher's grade — poll in the background so the gate clears itself the moment grading
  // lands, since the learner has no other way to find out short of manually reloading.
  const waitingOnGrading = hasPending && actionable.length === 0;
  useEffect(() => {
    if (!waitingOnGrading) return undefined;
    const interval = setInterval(() => refetch(), 15000);
    return () => clearInterval(interval);
  }, [waitingOnGrading, refetch]);

  if (!hasPending) {
    if (rowsLoading || !ensureSettled) return <LoadingState />;
    // Nothing to show — markComplete effect above should have already fired; layout will
    // refresh once the learner record updates. Nothing to render here in the meantime.
    if (nothingToShow) return null;
  }

  if (waitingOnGrading) return <AwaitingGradingState count={awaitingGradingCount} />;

  const total = totalRef.current || pending.length;
  const doneCount = total - actionable.length;
  const current = actionable[0];

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
        contextLabel={current.issue.learningAreaId ? areaNameById.get(current.issue.learningAreaId) : stageNameById.get(current.issue.ageCategoryId)}
        onDone={() => refetch()}
      />
    </div>
  );
}
