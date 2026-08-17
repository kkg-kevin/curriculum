import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiUsers } from "react-icons/fi";
import { useRosterForIssue, useGradeSubmission, useStartObservationSubmission, useGradeMilestone, useReissueAssessment } from "../../assessments/hooks/useAssessmentSubmission";
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

function LearnerRosterButton({ learner, submission, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", border: "none", borderBottom: `1px solid #F9FAFB`, backgroundColor: active ? T.tintBg : "transparent", cursor: "pointer" }}
    >
      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: active ? T.accent : T.ink }}>{learner.firstName} {learner.lastName}</p>
      <StatusBadge status={submission.status} />
      {submission.status === "graded" && (
        <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: T.accent }}>
          {submission.totalScore}/{submission.maxScore}
        </span>
      )}
    </button>
  );
}

// One milestone's own grading state — independent of everything else on the submission (see
// gradeMilestone's comment server-side). Starts in edit mode until it's been graded at least
// once; after a successful save, the row's own local state already holds what was just saved,
// so it flips to read mode without needing to wait on or re-sync from a refetch.
function MilestoneRow({ milestone, progress, isSaving, onSave }) {
  const [editing, setEditing] = useState(!progress);
  const [marks, setMarks] = useState(progress?.marks ?? 0);
  const [feedback, setFeedback] = useState(progress?.feedback ?? "");
  const max = Number(milestone.points) || 0;

  if (!editing) {
    return (
      <div style={{ padding: "10px 12px", backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>✓ {milestone.name}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{marks}/{max}</span>
            <button type="button" onClick={() => setEditing(true)} style={{ padding: 0, background: "none", border: "none", color: T.accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Edit</button>
          </div>
        </div>
        {feedback && <p style={{ margin: "6px 0 0", fontSize: 12, color: T.inkMuted, fontStyle: "italic" }}>“{feedback}”</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 12px", backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{milestone.name}</p>
          {milestone.description && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkFaint }}>{milestone.description}</p>}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.inkMuted, flexShrink: 0 }}>
          <input type="number" min={0} max={max} value={marks} onChange={(e) => setMarks(Math.min(max, Math.max(0, Number(e.target.value) || 0)))} style={{ width: 56, padding: "5px 7px", borderRadius: 7, border: `1.5px solid ${T.border}`, fontSize: 12.5, fontFamily: "Inter, sans-serif" }} />
          / {max}
        </label>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Feedback for this milestone…"
        style={{ padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 12.5, fontFamily: "Inter, sans-serif", minHeight: 50, resize: "vertical" }}
      />
      <button
        type="button"
        onClick={() => onSave(marks, feedback, () => setEditing(false))}
        disabled={isSaving}
        style={{ alignSelf: "flex-end", padding: "6px 14px", backgroundColor: isSaving ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isSaving ? "not-allowed" : "pointer" }}
      >
        {isSaving ? "Saving…" : progress ? "Update Milestone" : "Grade Milestone"}
      </button>
    </div>
  );
}

// A project's milestone checkpoints, graded one at a time, independently of the learner's own
// deliverable-submission progress below — a milestone releases to the learner the instant it's
// saved (see gradeMilestone's comment server-side), so there's no draft/publish step here.
// Rendered above the usual submission-status branching, since it applies (and should be usable)
// regardless of whether the learner has even started their own deliverables yet.
function MilestonesPanel({ assessment, submission, issueId, learnerId, onGraded }) {
  const { mutate: gradeMilestoneMutation, isPending, variables } = useGradeMilestone();
  const milestones = [...(assessment.milestones || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  if (milestones.length === 0 || !learnerId) return null;

  const progressByMilestone = new Map((submission?.milestoneProgress || []).map((p) => [p.milestoneId, p]));
  const gradedCount = progressByMilestone.size;
  const totalPoints = milestones.reduce((sum, m) => sum + (Number(m.points) || 0), 0);
  const earnedPoints = [...progressByMilestone.values()].reduce((sum, p) => sum + (Number(p.marks) || 0), 0);
  const allGraded = gradedCount === milestones.length;

  return (
    <div style={{ marginBottom: 16, padding: "14px 16px", border: `1.5px solid ${T.tintBorder}`, borderRadius: 12, backgroundColor: T.tintBg, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: T.accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>Milestones</p>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>
          {gradedCount}/{milestones.length} graded{allGraded ? ` · ${earnedPoints}/${totalPoints} overall` : ""}
        </span>
      </div>
      {milestones.map((m) => (
        <MilestoneRow
          key={m.id}
          milestone={m}
          progress={progressByMilestone.get(m.id)}
          isSaving={isPending && variables?.milestoneId === m.id}
          onSave={(marks, feedback, onDone) =>
            gradeMilestoneMutation({ issueId, milestoneId: m.id, learnerId, marks, feedback }, { onSuccess: (sub) => { onGraded(sub); onDone(); } })
          }
        />
      ))}
      {allGraded && (
        <p style={{ margin: 0, fontSize: 11.5, color: T.accentMid }}>Every milestone is graded — the learner sees the full breakdown plus this overall total.</p>
      )}
    </div>
  );
}

function GroupRosterButton({ group, members, submission, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", border: "none", borderBottom: `1px solid #F9FAFB`, backgroundColor: active ? T.tintBg : "transparent", cursor: "pointer" }}
    >
      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: active ? T.accent : T.ink, display: "flex", alignItems: "center", gap: 6 }}>
        <FiUsers size={13} /> {group.name}
      </p>
      <p style={{ margin: "0 0 6px", fontSize: 11, color: T.inkFaint }}>{members.length} member{members.length === 1 ? "" : "s"}</p>
      <StatusBadge status={submission.status} />
      {submission.status === "graded" && (
        <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: T.accent }}>
          {submission.totalScore}/{submission.maxScore}
        </span>
      )}
    </button>
  );
}

// Sits under the "Report published" box for a graded, individual (non-group) submission — lets
// the teacher give this one learner another attempt at the same assessment. Group submissions
// don't get this button at all (see reissueToLearner's comment server-side for why); a learner
// who's already been reissued and hasn't finished that new attempt gets a disabled state instead
// of a second button, rather than relying on the server's 409 to explain it after the fact.
function ReissueBox({ issueId, learnerId, learnerName }) {
  const { mutate: reissue, isPending, isSuccess } = useReissueAssessment();
  if (isSuccess) {
    return (
      <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}` }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.accent }}>Reissued</p>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkMuted }}>
          {learnerName} now has a fresh attempt at this assessment, with your feedback above shown as guidance.
        </p>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, backgroundColor: "#fff", border: `1.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>Didn't perform as expected?</p>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkMuted }}>Reissue this assessment to give {learnerName} another attempt — they'll see your feedback above as guidance.</p>
      </div>
      <button
        type="button"
        onClick={() => reissue({ issueId, learnerId })}
        disabled={isPending}
        style={{ padding: "8px 16px", backgroundColor: isPending ? "#F9FAFB" : "#feb139", color: "#25476a", border: "none", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
      >
        {isPending ? "Reissuing…" : "Reissue Assessment"}
      </button>
    </div>
  );
}

export default function AssessmentRosterPage() {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useRosterForIssue(issueId);
  const { mutate: grade, isPending: saving } = useGradeSubmission();
  const { mutate: startObservation, isPending: starting } = useStartObservationSubmission();
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  // Holds the freshly created submission for the brief window between "Begin Observation" and
  // the teacher actually grading it — the roster query (`data`) still has the stale "not_started"
  // placeholder until grading invalidates it (see useGradeSubmission), so this is what lets the
  // GradingPanel render immediately instead of waiting on a refetch. Cleared on every selection
  // change so switching rows never carries a started-but-abandoned submission into the wrong one.
  const [startedSubmission, setStartedSubmission] = useState(null);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!data) {
    return <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Assessment issue not found.</div>;
  }

  const { issue, assessment, roster, groups = [], ungroupedLearners = [] } = data;
  const isGroupMode = issue.groupMode;
  // Teacher Observation has no learner-facing "take" step — the teacher records it directly (see
  // startObservationSubmission on the server) instead of waiting on a submission that will never
  // arrive on its own.
  const isObservation = assessment.type === "observation";
  const hasMilestones = assessment.type === "project" && (assessment.milestones || []).length > 0;

  const selectLearner = (id) => { setSelectedLearnerId(id); setSelectedGroupId(null); setStartedSubmission(null); };
  const selectGroup = (id) => { setSelectedGroupId(id); setSelectedLearnerId(null); setStartedSubmission(null); };

  const selectedGroupRow = selectedGroupId ? groups.find((g) => g.group.id === selectedGroupId) : null;
  const selectedLearnerRow = selectedLearnerId ? roster.find((r) => r.learner.id === selectedLearnerId) : null;
  // Whichever is active — a group row's `submission` is its representative member's row (grading
  // it fans out to every member server-side), an individual row's is just their own.
  const selectedSubmission = startedSubmission || selectedGroupRow?.submission || selectedLearnerRow?.submission || null;

  const handleBeginObservation = () => {
    // A group row's own `members` array supplies the representative learner to start against —
    // same "grading one member fans out to the whole group" mechanic every group submission
    // already uses (see getOrCreateSubmission's group-resolution branch server-side).
    const learnerId = selectedGroupRow ? selectedGroupRow.members[0]?.id : selectedLearnerRow?.learner.id;
    if (!learnerId) return;
    startObservation({ issueId: issue.id, learnerId }, { onSuccess: (submission) => setStartedSubmission(submission) });
  };

  const countableRows = isGroupMode
    ? [...groups.map((g) => g.submission), ...ungroupedLearners.map((r) => r.submission)]
    : roster.map((r) => r.submission);
  const totalCount = isGroupMode ? groups.length + ungroupedLearners.length : roster.length;
  const submitted = countableRows.filter((s) => s.status !== "not_started" && s.status !== "in_progress").length;
  const gradedCount = countableRows.filter((s) => s.status === "graded").length;
  const publishedCount = countableRows.filter((s) => s.status === "graded" && s.reportPublished).length;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={() => navigate("/teacher-portal/assessments")} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 20, color: T.inkMuted, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
        ← My Assessments
      </button>

      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
            {assessment.name}
            {isGroupMode && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <FiUsers size={12} /> Group Assessment
              </span>
            )}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{submitted} of {totalCount} submitted · {gradedCount} graded · {publishedCount} reports published</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>{isGroupMode ? "Groups" : "Roster"}</p>
          </div>
          {!isGroupMode ? (
            roster.length === 0 ? (
              <p style={{ margin: 0, padding: "24px 16px", fontSize: 13, color: T.inkFaint, textAlign: "center" }}>No learners in this class yet.</p>
            ) : (
              roster.map(({ learner, submission }) => (
                <LearnerRosterButton key={learner.id} learner={learner} submission={submission} active={learner.id === selectedLearnerId} onClick={() => selectLearner(learner.id)} />
              ))
            )
          ) : (
            <>
              {groups.length === 0 ? (
                <p style={{ margin: 0, padding: "16px", fontSize: 12.5, color: T.inkFaint }}>No groups created yet — set them up from the class page first.</p>
              ) : (
                groups.map(({ group, members, submission }) => (
                  <GroupRosterButton key={group.id} group={group} members={members} submission={submission} active={group.id === selectedGroupId} onClick={() => selectGroup(group.id)} />
                ))
              )}
              {ungroupedLearners.length > 0 && (
                <>
                  <div style={{ padding: "10px 16px", backgroundColor: "#FFFBEB", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
                    <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em" }}>Not in a group</p>
                  </div>
                  {ungroupedLearners.map(({ learner, submission }) => (
                    <LearnerRosterButton key={learner.id} learner={learner} submission={submission} active={learner.id === selectedLearnerId} onClick={() => selectLearner(learner.id)} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <div style={{ ...cardStyle, padding: "20px 22px", minHeight: 300 }}>
          {hasMilestones && selectedSubmission && (
            <MilestonesPanel
              assessment={assessment}
              submission={selectedSubmission}
              issueId={issue.id}
              learnerId={selectedGroupRow ? selectedGroupRow.members[0]?.id : selectedLearnerRow?.learner.id}
              onGraded={(sub) => setStartedSubmission(sub)}
            />
          )}
          {!selectedSubmission ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: T.inkFaint, fontSize: 13.5 }}>
              Select a {isGroupMode ? "group" : "learner"} from the list to view or grade their submission.
            </div>
          ) : isObservation && selectedSubmission.status === "not_started" ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: T.ink }}>
                No observation recorded yet for {selectedGroupRow ? selectedGroupRow.group.name : `${selectedLearnerRow.learner.firstName} ${selectedLearnerRow.learner.lastName}`}
              </h3>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: T.inkMuted, maxWidth: 380, marginInline: "auto" }}>
                This is recorded by you directly — there's nothing for {isGroupMode ? "the group" : "the learner"} to submit first.
              </p>
              <button
                type="button"
                onClick={handleBeginObservation}
                disabled={starting}
                style={{ padding: "12px 28px", backgroundColor: starting ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: starting ? "not-allowed" : "pointer" }}
              >
                {starting ? "Starting…" : "Begin Observation"}
              </button>
            </div>
          ) : !isObservation && (selectedSubmission.status === "not_started" || selectedSubmission.status === "in_progress") ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: T.ink }}>
                {selectedGroupRow ? selectedGroupRow.group.name : `${selectedLearnerRow.learner.firstName} ${selectedLearnerRow.learner.lastName}`} hasn't submitted yet
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>{selectedSubmission.status === "in_progress" ? "They've started but not submitted." : "Nothing to grade until they submit."}</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                {selectedGroupRow ? (
                  <>
                    <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
                      <FiUsers size={16} /> {selectedGroupRow.group.name}
                    </h2>
                    <p style={{ margin: "0 0 4px", fontSize: 12, color: T.inkMuted }}>
                      {selectedGroupRow.members.map((m) => `${m.firstName} ${m.lastName}`).join(", ")}
                    </p>
                  </>
                ) : (
                  <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: T.ink }}>{selectedLearnerRow.learner.firstName} {selectedLearnerRow.learner.lastName}</h2>
                )}
                <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>
                  {/* An observation never goes through a learner "submit" step, so submittedAt
                      stays null for its whole life — nothing to show once it's graded either,
                      since the "Report published" box below already covers that. */}
                  {selectedSubmission.submittedAt
                    ? `Submitted ${new Date(selectedSubmission.submittedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}`
                    : isObservation && selectedSubmission.status !== "graded" ? "Recording in progress" : ""}
                </p>
              </div>
              {selectedGroupRow && selectedSubmission.status !== "graded" && (
                <div style={{ marginBottom: 14, padding: "10px 14px", backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: T.accent, fontWeight: 600 }}>
                    Grading this submission applies the same mark and feedback to all {selectedGroupRow.members.length} group members.
                  </p>
                </div>
              )}
              <GradingPanel
                assessment={assessment}
                submission={selectedSubmission}
                isSaving={saving}
                onSave={(payload) => grade({ id: selectedSubmission.id, ...payload })}
              />
              {selectedSubmission.status === "graded" && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 16px",
                    borderRadius: 10,
                    backgroundColor: "#ECFDF5",
                    border: "1.5px solid #A7F3D0",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#059669" }}>Report published</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkMuted }}>
                    {selectedSubmission.reportPublishedAt
                      ? `Published ${new Date(selectedSubmission.reportPublishedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}`
                      : "Visible to the learner."}
                    {selectedGroupRow ? ` · Applies to all ${selectedGroupRow.members.length} group members.` : ""}
                  </p>
                </div>
              )}
              {selectedSubmission.status === "graded" && !selectedGroupRow && selectedLearnerRow && (
                <ReissueBox
                  key={selectedLearnerRow.learner.id}
                  issueId={issue.id}
                  learnerId={selectedLearnerRow.learner.id}
                  learnerName={`${selectedLearnerRow.learner.firstName} ${selectedLearnerRow.learner.lastName}`}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
