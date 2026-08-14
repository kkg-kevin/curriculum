import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiUsers } from "react-icons/fi";
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

export default function AssessmentRosterPage() {
  const { issueId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useRosterForIssue(issueId);
  const { mutate: grade, isPending: saving } = useGradeSubmission();
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!data) {
    return <div style={{ padding: "40px", fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Assessment issue not found.</div>;
  }

  const { issue, assessment, roster, groups = [], ungroupedLearners = [] } = data;
  const isGroupMode = issue.groupMode;

  const selectLearner = (id) => { setSelectedLearnerId(id); setSelectedGroupId(null); };
  const selectGroup = (id) => { setSelectedGroupId(id); setSelectedLearnerId(null); };

  const selectedGroupRow = selectedGroupId ? groups.find((g) => g.group.id === selectedGroupId) : null;
  const selectedLearnerRow = selectedLearnerId ? roster.find((r) => r.learner.id === selectedLearnerId) : null;
  // Whichever is active — a group row's `submission` is its representative member's row (grading
  // it fans out to every member server-side), an individual row's is just their own.
  const selectedSubmission = selectedGroupRow?.submission || selectedLearnerRow?.submission || null;

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
          {!selectedSubmission ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: T.inkFaint, fontSize: 13.5 }}>
              Select a {isGroupMode ? "group" : "learner"} from the list to view or grade their submission.
            </div>
          ) : selectedSubmission.status === "not_started" || selectedSubmission.status === "in_progress" ? (
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
                  Submitted {new Date(selectedSubmission.submittedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
