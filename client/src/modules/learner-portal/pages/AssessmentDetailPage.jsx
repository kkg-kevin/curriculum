import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { usePortalNavigate } from "../utils/usePortalNavigate";
import { FiClock, FiRefreshCw, FiSend } from "react-icons/fi";
import { useIssuedForLearner, useStartSubmission, useSaveDraft, useSubmitAssessment, useDiagnosticForLearner, usePathwayDiagnosticsForLearner } from "../../assessments/hooks/useAssessmentSubmission";
import { useAssessmentCompetencies } from "../../assessments/hooks/useAssessment";
import { useLearnerCompetencyScores } from "../../curriculum/hooks/useCompetencies";
import { normalizeLegacyItem } from "../../assessments/schemas/assessment.schema";
import AssessmentTaker, { unansweredWrittenItems, questionList } from "../../assessments/components/AssessmentTaker";
import GroupPanel from "../../assessments/components/GroupPanel";
import AssessmentResultView from "../components/AssessmentResultView";
import { useGroupForLearner } from "../../classes/hooks/useClassGroups";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
// A project's milestone checkpoints — visible regardless of the submission's own status, since
// the teacher grades these directly and independently of the learner's deliverable-upload
// progress (see gradeMilestone's comment server-side). Each one shows the moment it's graded;
// once every milestone has a grade, a general summary total appears underneath.
function MilestonesCard({ milestones, progress }) {
  if (!milestones || milestones.length === 0) return null;
  const progressByMilestone = new Map((progress || []).map((p) => [p.milestoneId, p]));
  const gradedCount = progressByMilestone.size;
  const totalPoints = milestones.reduce((sum, m) => sum + (Number(m.points) || 0), 0);
  const earnedPoints = [...progressByMilestone.values()].reduce((sum, p) => sum + (Number(p.marks) || 0), 0);
  const allGraded = gradedCount === milestones.length;
  const sorted = [...milestones].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div style={{ ...cardStyle, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.ink }}>Milestones</p>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{gradedCount}/{milestones.length} graded</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((m) => {
          const p = progressByMilestone.get(m.id);
          return (
            <div key={m.id} style={{ padding: "10px 14px", backgroundColor: p ? "#F7FEFB" : "#FAFBFF", border: `1px solid ${p ? "#D1FAE5" : T.border}`, borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{m.name}</p>
                {p ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{p.marks}/{m.points}</span>
                ) : (
                  <span style={{ fontSize: 11, color: T.inkFaint, fontStyle: "italic" }}>Not yet graded</span>
                )}
              </div>
              {m.description && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: T.inkMuted }}>{m.description}</p>}
              {p?.feedback && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: T.ink, fontStyle: "italic", borderTop: "1px solid #D1FAE5", paddingTop: 6 }}>“{p.feedback}”</p>
              )}
            </div>
          );
        })}
      </div>
      {allGraded && (
        <div style={{ padding: "10px 14px", backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.accent }}>General Summary</p>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.accent }}>{earnedPoints}/{totalPoints}</span>
        </div>
      )}
    </div>
  );
}

// Shown whenever this issue was created by a teacher's "Reissue" action (see reissueToLearner
// server-side) — surfaces the PRIOR attempt's score/feedback as guidance for this fresh one,
// rather than making the learner dig through Reports to find what they need to improve on.
// `originalRow` may be missing (original issue revoked, or just not yet loaded) — the notice
// still shows, just without the specific feedback quoted underneath.
function ReissueNotice({ originalRow }) {
  const originalSubmission = originalRow?.submission;
  const hasPriorFeedback = originalSubmission?.status === "graded" && (originalSubmission.overallFeedback || originalSubmission.maxScore);
  return (
    <div style={{ ...cardStyle, padding: "16px 20px", backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: "#92400E", display: "flex", alignItems: "center", gap: 7 }}>
        <FiRefreshCw size={13} /> Reissued Assessment — Another Attempt
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: T.ink }}>
        Your teacher gave you another chance at this assessment. Use the feedback below to do better this time.
      </p>
      {hasPriorFeedback && (
        <div style={{ marginTop: 10, padding: "10px 14px", backgroundColor: "#fff", border: "1px solid #FDE68A", borderRadius: 10 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Previous attempt{originalSubmission.maxScore ? ` — ${originalSubmission.totalScore}/${originalSubmission.maxScore}` : ""}
          </p>
          {originalSubmission.overallFeedback && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.ink, fontStyle: "italic" }}>“{originalSubmission.overallFeedback}”</p>
          )}
        </div>
      )}
    </div>
  );
}

// Ticking countdown from the submission's own createdAt — stamped once, the instant the learner
// first opened it, and never reset by saveDraft — so this reflects the same deadline the server
// enforces (see assessment-submission.service.js's isExpired) regardless of how many times the
// learner has closed and reopened this page. onExpire fires the exact same submit the learner's
// own Submit button uses, so whatever's currently in AssessmentTaker's draft state gets saved as
// their final answer rather than losing work to a hard cutoff. onExpireRef sidesteps re-running
// the interval every time the parent re-renders (which it does on every keystroke, since
// handleSubmit closes over draftAnswers) — the effect itself only depends on the stable deadline.
function TimeLimitBanner({ createdAt, timeLimitMinutes, onExpire }) {
  const deadline = useMemo(() => new Date(createdAt).getTime() + timeLimitMinutes * 60000, [createdAt, timeLimitMinutes]);
  const [remainingMs, setRemainingMs] = useState(() => deadline - Date.now());
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const tick = () => {
      const remaining = deadline - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const clamped = Math.max(0, remainingMs);
  const expired = remainingMs <= 0;
  const urgent = !expired && clamped <= 5 * 60 * 1000;
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const label = hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
  const color = expired ? "#DC2626" : urgent ? "#B45309" : T.accent;

  return (
    <div style={{
      ...cardStyle, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      backgroundColor: expired ? "#FEF2F2" : urgent ? "#FFFBEB" : T.tintBg,
      border: `1.5px solid ${expired ? "#FECACA" : urgent ? "#FDE68A" : T.tintBorder}`,
      position: "sticky", top: 8, zIndex: 5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <FiClock size={16} color={color} />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color }}>
          {expired ? "Time's up — submitting your answers…" : "Time remaining"}
        </p>
      </div>
      {!expired && <span style={{ fontSize: 19, fontWeight: 900, fontVariantNumeric: "tabular-nums", color }}>{label}</span>}
    </div>
  );
}

export default function AssessmentDetailPage() {
  const { issueId } = useParams();
  const navigate = usePortalNavigate();
  // viewOnly: a parent looking at their child's work (parent portal) — they can see it, not do it.
  const { cls, learner, viewOnly, selectedHub } = useOutletContext();
  // Every attempt, a replaced one too — it can still be opened by its id (report links), and a
  // reissue shows the one before it as guidance.
  const { data, isLoading } = useIssuedForLearner(undefined, { includeReplaced: true });
  // A Developmental Stage or Pathway diagnostic never shows up in useIssuedForLearner()
  // above — getIssuedRowsForLearner (server) deliberately excludes them, since the general "My
  // Assessments" list they normally feed isn't where diagnostics belong. But once graded, a
  // diagnostic's own result page still needs to resolve here — it's what the Reports list's
  // "Diagnostics" section (see ReportsOverview.jsx's DiagnosticRow) links to.
  const { data: stageRow, isLoading: stageLoading } = useDiagnosticForLearner(learner?.id, cls?.curriculumId);
  const { data: areaRows = [], isLoading: areaLoading } = usePathwayDiagnosticsForLearner(learner?.id);
  const diagnosticRows = [stageRow, ...areaRows].filter(Boolean);
  const row = (data?.data || []).find((r) => r.issue.id === issueId) || diagnosticRows.find((r) => r.issue.id === issueId);
  // If this issue was created by a teacher's "Reissue" action, its origin issue targeted this
  // same learner and is (almost always) still in this same list — reused here instead of a new
  // fetch. See ReissueNotice.
  const originalRow = row?.issue?.reissuedFromIssueId
    ? (data?.data || []).find((r) => r.issue.id === row.issue.reissuedFromIssueId)
    : null;
  // Only meaningful for group-mode issues, but cheap/cached like the diagnostic queries above —
  // no need to gate the call itself, GroupPanel just isn't rendered when there's no group issue.
  const { data: group } = useGroupForLearner(cls?.id, learner?.id);

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
  const deliverables = row?.assessment?.deliverables || [];
  const autoByItem = useMemo(() => new Map((submission?.autoItemResults || []).map((r) => [r.itemId, r])), [submission?.autoItemResults]);
  const feedbackByKey = useMemo(() => new Map((submission?.itemFeedback || []).map((f) => [f.itemId, f])), [submission?.itemFeedback]);
  const answersByItem = useMemo(() => new Map((submission?.answers || []).map((a) => [a.itemId, a.response])), [submission?.answers]);

  // Resolves the graded submission's indicatorBreakdown (bare indicatorIds — see
  // grading.utils.js's computeIndicatorBreakdown) to a display name, same competencies already
  // tagged onto this assessment at authoring time.
  const { data: linkedCompetencies = [] } = useAssessmentCompetencies(row?.assessment?.id, { enabled: !!row?.assessment?.id });
  const indicatorNameById = useMemo(() => {
    const map = new Map();
    linkedCompetencies.forEach((comp) => (comp.indicators || []).forEach((ind) => map.set(ind.id, { name: ind.name, competencyName: comp.name, competencyId: comp.id })));
    return map;
  }, [linkedCompetencies]);

  // Real per-learner score/band per competency (Evidence Type → Assessment Type → Engine
  // pipeline) — shown alongside each indicator's flat marks so a learner can see how this one
  // graded assessment connects to their overall standing on that competency.
  const { data: scoreRows = [] } = useLearnerCompetencyScores(cls?.curriculumId, learner?.id, selectedHub?.id);
  const scoreByCompetencyId = useMemo(() => new Map(scoreRows.map((r) => [r.competencyId, r])), [scoreRows]);

  if (isLoading || stageLoading || areaLoading) {
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
  // Written questions still blank: Submit waits for them (the server refuses them too). The time
  // limit running out hands in whatever is there (handleSubmit straight from the banner).
  const currentAnswers = draftAnswers || submission?.answers || [];
  const unanswered = assessment ? unansweredWrittenItems(assessment, currentAnswers) : [];
  const unansweredIds = new Set(unanswered.map((u) => u.itemId));
  const handleSubmit = () => submitAssessment({ id: submission.id, answers: draftAnswers || submission.answers || [] }, {
    onSuccess: (sub) => setActiveSubmission(sub),
  });

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={() => navigate("/learner-portal/assessments")} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 20, color: T.inkMuted, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        {viewOnly ? "← Back to profile" : "← My Assessments"}
      </button>

      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#fff" }}>{assessment.name}</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{stripDescription(assessment.description)}</p>
        </div>
      </div>

      {row.issue.reissuedFromIssueId && <ReissueNotice originalRow={originalRow} />}

      {/* An earlier attempt a reissue replaced (opened from an old link) — point at the new one. */}
      {row.replacedBy && (
        <div style={{ ...cardStyle, padding: "14px 20px", backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <p style={{ margin: 0, flex: 1, minWidth: 200, fontSize: 13, color: T.ink }}>This was an earlier attempt — your teacher gave you another try, which replaces it.</p>
          <button type="button" onClick={() => navigate(`/learner-portal/assessments/${row.replacedBy}`)} style={{ padding: "8px 16px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Open your new attempt
          </button>
        </div>
      )}

      {row.issue.groupMode && <GroupPanel group={group} />}

      {submission?.status !== "graded" && <MilestonesCard milestones={assessment.milestones} progress={submission?.milestoneProgress} />}

      {viewOnly && (!submission || submission.status === "not_started" || submission.status === "in_progress") ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>
            {submission?.status === "in_progress" ? `${learner?.firstName || "Your child"} has started this` : `Waiting for ${learner?.firstName || "your child"} to start`}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted, maxWidth: 440, marginInline: "auto" }}>
            {learner?.firstName || "They"} does this on their own login.{row.issue.dueDate ? ` It's due ${row.issue.dueDate}.` : ""} You'll see the result and feedback here once it's marked.
          </p>
        </div>
      ) : !submission || submission.status === "not_started" ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: T.accent, fontSize: 24 }}><FiSend /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>Ready when you are</h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: T.inkMuted, maxWidth: 420, marginInline: "auto" }}>
            {items.length > 0 ? `${items.length} question${items.length === 1 ? "" : "s"}. ` : ""}
            {deliverables.length > 0 ? `${deliverables.length} deliverable${deliverables.length === 1 ? "" : "s"} to submit. ` : ""}
            You can save your progress and come back before submitting.
            {row.issue.timeLimitMinutes ? ` Once you start, you'll have ${row.issue.timeLimitMinutes >= 60 && row.issue.timeLimitMinutes % 60 === 0 ? `${row.issue.timeLimitMinutes / 60} hour${row.issue.timeLimitMinutes === 60 ? "" : "s"}` : `${row.issue.timeLimitMinutes} minutes`} to finish — the clock keeps running even if you save and come back later.` : ""}
          </p>
          <button type="button" onClick={handleStart} disabled={starting} style={{ padding: "12px 28px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: starting ? "not-allowed" : "pointer" }}>
            {starting ? "Starting…" : "Start Assessment"}
          </button>
        </div>
      ) : submission.status === "in_progress" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {row.issue.timeLimitMinutes && (
            <TimeLimitBanner createdAt={submission.createdAt} timeLimitMinutes={row.issue.timeLimitMinutes} onExpire={handleSubmit} />
          )}
          <AssessmentTaker assessment={assessment} initialAnswers={submission.answers} onChange={setDraftAnswers} needsAnswerIds={unansweredIds} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={handleSaveDraft} disabled={saving} style={{ padding: "10px 20px", backgroundColor: "#fff", color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save Draft"}
            </button>
            {unanswered.length > 0 && (
              <span style={{ alignSelf: "center", fontSize: 12.5, fontWeight: 600, color: "#92400E" }}>
                Write your answer to {questionList(unanswered.map((u) => u.number))} to hand it in.
              </span>
            )}
            <button type="button" onClick={handleSubmit} disabled={submitting || unanswered.length > 0} style={{ padding: "10px 24px", backgroundColor: submitting || unanswered.length > 0 ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: submitting || unanswered.length > 0 ? "not-allowed" : "pointer" }}>
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
        // Marked: laid out like the learner's reports (AssessmentResultView).
        <AssessmentResultView
          row={row}
          submission={submission}
          items={items}
          answersByItem={answersByItem}
          autoByItem={autoByItem}
          feedbackByKey={feedbackByKey}
          indicatorNameById={indicatorNameById}
          scoreByCompetencyId={scoreByCompetencyId}
          audience={viewOnly ? "parent" : "learner"}
          firstName={learner?.firstName || ""}
          onOpenReports={() => navigate("/learner-portal/reports")}
          milestones={assessment.milestones || []}
          milestoneProgress={submission?.milestoneProgress || []}
        />
      )}
    </div>
  );
}

function stripDescription(html) {
  if (!html) return "Review your grade and feedback once your teacher has graded this.";
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text || "Review your grade and feedback once your teacher has graded this.";
}
