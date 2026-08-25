import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { FiCheckCircle, FiClock, FiRefreshCw, FiSend } from "react-icons/fi";
import { useIssuedForLearner, useStartSubmission, useSaveDraft, useSubmitAssessment, useDiagnosticForLearner, useLearningAreaDiagnosticsForLearner } from "../../assessments/hooks/useAssessmentSubmission";
import { useAssessmentCompetencies } from "../../assessments/hooks/useAssessment";
import { useLearnerCompetencyScores } from "../../curriculum/hooks/useCompetencies";
import { normalizeLegacyItem, entryMarks } from "../../assessments/schemas/assessment.schema";
import AssessmentTaker from "../../assessments/components/AssessmentTaker";
import RichContent from "../../assessments/components/RichContent";
import GroupPanel from "../../assessments/components/GroupPanel";
import { useGroupForLearner } from "../../classes/hooks/useClassGroups";

const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const AUTO_GRADABLE_KINDS = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank"];

function formatResponse(response) {
  if (response == null || response === "") return <em style={{ color: T.inkFaint }}>No answer given</em>;
  if (Array.isArray(response)) {
    if (response.length && typeof response[0] === "object") return response.map((p) => `${p.left} → ${p.right}`).join(", ");
    return response.join(", ");
  }
  // File-upload items and project deliverables store {url, filename, mimeType, size} — every
  // other kind stores a string or string[] (see grading.utils.js's response contract).
  if (typeof response === "object" && response.url) {
    return <a href={response.url} target="_blank" rel="noopener noreferrer" style={{ color: T.accent, fontWeight: 600 }}>{response.filename || "View uploaded file"}</a>;
  }
  return String(response);
}

// The curriculum's own weighted Evidence/Assessment-Type band for a competency this indicator
// belongs to — a different, cumulative-across-all-assessments number from the flat marks/percent
// shown alongside it, same source as the Profile page's Competencies tab.
function BandBadge({ band }) {
  if (!band) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, borderRadius: 20, padding: "1px 7px", whiteSpace: "nowrap" }}>
      {band.name}
    </span>
  );
}

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
  const navigate = useNavigate();
  const { cls, learner } = useOutletContext();
  const { data, isLoading } = useIssuedForLearner();
  // A Developmental Stage or Learning-Area diagnostic never shows up in useIssuedForLearner()
  // above — getIssuedRowsForLearner (server) deliberately excludes them, since the general "My
  // Assessments" list they normally feed isn't where diagnostics belong. But once graded, a
  // diagnostic's own result page still needs to resolve here — it's what the Reports list's
  // "Diagnostics" section (see ReportsOverview.jsx's DiagnosticRow) links to.
  const { data: stageRow, isLoading: stageLoading } = useDiagnosticForLearner(learner?.id, cls?.curriculumId);
  const { data: areaRows = [], isLoading: areaLoading } = useLearningAreaDiagnosticsForLearner(learner?.id);
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
  const rubric = row?.assessment?.rubric || [];
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
  const { data: scoreRows = [] } = useLearnerCompetencyScores(cls?.curriculumId, learner?.id);
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

      {row.issue.reissuedFromIssueId && <ReissueNotice originalRow={originalRow} />}

      {row.issue.groupMode && <GroupPanel group={group} />}

      <MilestonesCard milestones={assessment.milestones} progress={submission?.milestoneProgress} />

      {!submission || submission.status === "not_started" ? (
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
          <div style={{ ...cardStyle, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669", fontSize: 22, flexShrink: 0 }}><FiCheckCircle /></div>
              <div>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#059669" }}>{submission.totalScore} / {submission.maxScore}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>
                  {submission.maxScore ? `${Math.round((submission.totalScore / submission.maxScore) * 100)}%` : ""} · Graded {new Date(submission.gradedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/learner-portal/reports")}
              style={{ padding: "8px 16px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              View in Reports →
            </button>
          </div>

          {submission.indicatorBreakdown?.length > 0 && (
            <div style={{ ...cardStyle, padding: "16px 20px" }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Competency Breakdown</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {submission.indicatorBreakdown.map((entry) => {
                  const resolved = indicatorNameById.get(entry.indicatorId);
                  const percent = entry.marksPossible > 0 ? Math.round((entry.marksEarned / entry.marksPossible) * 100) : 0;
                  const scoreEntry = scoreByCompetencyId.get(resolved?.competencyId);
                  return (
                    <div key={entry.indicatorId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.ink }}>{resolved?.name || "Indicator"}</p>
                        {resolved?.competencyName && (
                          <p style={{ margin: 0, fontSize: 11, color: T.inkFaint, display: "flex", alignItems: "center", gap: 6 }}>
                            {resolved.competencyName}
                            <BandBadge band={scoreEntry?.band} />
                          </p>
                        )}
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: percent >= 60 ? "#059669" : "#DC2626", whiteSpace: "nowrap" }}>
                        {entry.marksEarned}/{entry.marksPossible} · {percent}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {submission.overallFeedback && (
            <div style={{ ...cardStyle, padding: "16px 20px", backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}` }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Educator Feedback</p>
              <p style={{ margin: 0, fontSize: 13.5, color: T.ink }}>{submission.overallFeedback}</p>
              {(submission.gradedByName || submission.gradedAt) && (
                <p style={{ margin: "8px 0 0", fontSize: 11, color: T.accentMid }}>
                  {submission.gradedByName ? `— ${submission.gradedByName}` : ""}
                  {submission.gradedByName && submission.gradedAt ? " · " : ""}
                  {submission.gradedAt ? new Date(submission.gradedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : ""}
                </p>
              )}
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

          {deliverables.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your Deliverables</p>
              {deliverables.map((d) => (
                <div key={d.id} style={{ padding: "12px 14px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{d.name}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.inkMuted }}>{formatResponse(answersByItem.get(d.id))}</p>
                </div>
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
