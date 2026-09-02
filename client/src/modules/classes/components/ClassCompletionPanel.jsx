import { useState } from "react";
import { FiCheck, FiClock, FiChevronDown, FiChevronRight, FiAlertCircle } from "react-icons/fi";
import { useCompletionStatus, useMarkSessionNotSubmitted } from "../hooks/useClasses";
import { useClassOccurrences, useOccurrenceAction } from "../../timetable/hooks/useTimetable";

const ACCENT = "#25476a";
const GREEN = "#059669";
const AMBER = "#92400E";

// The four-metric year-completion checklist for a class — every metric is derived live server-
// side (ClassService.getCompletionStatus); this panel only renders the breakdown and offers the
// close-out actions that resolve each pending item:
//   1. sessions taught    → mark-taught / cancel on each pending occurrence
//   2. grading            → (read-only here; a teacher grades on the assessment's own roster)
//   3. attendance closed  → lock-attendance on each pending occurrence
//   4. reports filed      → "file as not submitted" for each learner who never submitted
export default function ClassCompletionPanel({ classId }) {
  const { data: status, isLoading } = useCompletionStatus(classId);
  const { data: occurrences = [] } = useClassOccurrences(classId);
  const occAction = useOccurrenceAction(classId);
  const markNotSubmitted = useMarkSessionNotSubmitted();
  const [expanded, setExpanded] = useState(null);

  const cardStyle = { backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Year Completion</h3>
      {status?.complete && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "#dcfce7", color: GREEN, border: "1px solid #86efac" }}>
          <FiCheck size={11} /> Complete
        </span>
      )}
    </div>
  );

  if (isLoading || !status) {
    return <div style={cardStyle}>{header}<p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Loading…</p></div>;
  }

  if (!status.applicable) {
    return (
      <div style={cardStyle}>
        {header}
        <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
          Nothing to complete yet — this class needs enrolled learners, assigned courses, and at least one past session before its year can be closed out.
        </p>
      </div>
    );
  }

  const m = status.metrics;
  const occById = new Map(occurrences.map((o) => [o.id, o]));

  const rows = [
    {
      key: "sessionsTaught",
      label: "All sessions taught",
      metric: m.sessionsTaught,
      detail: `${m.sessionsTaught.taught} taught · ${m.sessionsTaught.cancelled} cancelled · ${m.sessionsTaught.pendingCount} pending`,
    },
    {
      key: "grading",
      label: "All assessments graded",
      metric: m.grading,
      detail: `${m.grading.ready}/${m.grading.total} learner–course records fully graded · ${m.grading.pendingCount} submission${m.grading.pendingCount !== 1 ? "s" : ""} awaiting grading`,
    },
    {
      key: "attendanceClosed",
      label: "Attendance taken to the last session",
      metric: m.attendanceClosed,
      detail: `${m.attendanceClosed.taken} marked · ${m.attendanceClosed.lockedNotMarked} locked as not marked · ${m.attendanceClosed.pendingCount} pending`,
    },
    {
      key: "reports",
      label: "Every assessment report accounted for",
      metric: m.reports,
      detail: `${m.reports.pendingCount} learner–session report${m.reports.pendingCount !== 1 ? "s" : ""} still to file`,
    },
  ];

  return (
    <div style={cardStyle}>
      {header}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => {
          const done = row.metric.done;
          const isOpen = expanded === row.key;
          const hasDrilldown = row.key !== "grading" && !done;
          return (
            <div key={row.key} style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => hasDrilldown && setExpanded(isOpen ? null : row.key)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  background: "none", border: "none", textAlign: "left",
                  cursor: hasDrilldown ? "pointer" : "default", fontFamily: "Inter, sans-serif",
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: done ? "#dcfce7" : "#FEF3C7", color: done ? GREEN : AMBER,
                }}>
                  {done ? <FiCheck size={12} strokeWidth={3} /> : <FiClock size={12} strokeWidth={2.5} />}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>{row.label}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "#9CA3AF", marginTop: 1 }}>{row.detail}</span>
                </span>
                {hasDrilldown && (isOpen ? <FiChevronDown size={15} color="#9CA3AF" /> : <FiChevronRight size={15} color="#9CA3AF" />)}
              </button>

              {isOpen && row.key === "sessionsTaught" && (
                <PendingSessions
                  items={row.metric.pending}
                  actionLabel="Mark taught"
                  secondaryLabel="Cancel"
                  busy={occAction.isPending}
                  onPrimary={(occId) => occAction.mutate({ occurrenceId: occId, action: "mark-taught" })}
                  onSecondary={(occId) => occAction.mutate({ occurrenceId: occId, action: "cancel" })}
                  resolveOcc={(item) => occById.get(item.id)}
                />
              )}

              {isOpen && row.key === "attendanceClosed" && (
                <PendingSessions
                  items={row.metric.pending}
                  actionLabel="Close as not marked"
                  busy={occAction.isPending}
                  onPrimary={(occId) => occAction.mutate({ occurrenceId: occId, action: "lock-attendance" })}
                  resolveOcc={(item) => occById.get(item.id)}
                />
              )}

              {isOpen && row.key === "reports" && (
                <PendingReports
                  items={status.unresolved.notSubmitted}
                  needsGrading={status.unresolved.needsGrading}
                  busy={markNotSubmitted.isPending}
                  onFile={(item) => markNotSubmitted.mutate({ classId, courseId: item.courseId, sessionId: item.sessionId, learnerId: item.learnerId })}
                />
              )}
            </div>
          );
        })}
      </div>

      {m.grading.pendingCount > 0 && (
        <p style={{ margin: "14px 0 0", fontSize: 11.5, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 6 }}>
          <FiAlertCircle size={12} /> Submissions awaiting grading are graded from each assessment's own roster, not here.
        </p>
      )}
    </div>
  );
}

function sessionLabel(item) {
  const name = item.sessionTitle || (item.sessionOrder != null ? `Session ${item.sessionOrder}` : "Session");
  return item.courseName ? `${item.courseName} · ${name}` : name;
}

function PendingSessions({ items, actionLabel, secondaryLabel, onPrimary, onSecondary, busy, resolveOcc }) {
  if (!items?.length) return null;
  return (
    <div style={{ borderTop: "1px solid #E5E7EB", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, backgroundColor: "#F9FAFB" }}>
      {items.map((item) => {
        const occ = resolveOcc(item);
        return (
          <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#374151" }}>
              {sessionLabel(item)} <span style={{ color: "#9CA3AF" }}>· {item.date}</span>
            </span>
            <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {secondaryLabel && onSecondary && (
                <button
                  type="button"
                  disabled={busy || !occ}
                  onClick={() => onSecondary(item.id)}
                  style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif", borderRadius: 7, border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280", cursor: busy ? "not-allowed" : "pointer" }}
                >
                  {secondaryLabel}
                </button>
              )}
              <button
                type="button"
                disabled={busy || !occ}
                onClick={() => onPrimary(item.id)}
                style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", borderRadius: 7, border: "none", background: busy ? "#b8d9ee" : ACCENT, color: "#fff", cursor: busy ? "not-allowed" : "pointer" }}
              >
                {actionLabel}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PendingReports({ items, needsGrading, onFile, busy }) {
  const learnerName = (l) => (l ? `${l.firstName} ${l.lastName}` : "Learner");
  return (
    <div style={{ borderTop: "1px solid #E5E7EB", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, backgroundColor: "#F9FAFB" }}>
      {needsGrading?.length > 0 && (
        <p style={{ margin: "0 0 4px", fontSize: 11.5, color: AMBER }}>
          {needsGrading.length} submission{needsGrading.length !== 1 ? "s" : ""} still need grading first — grade those from the assessment roster, then file the rest here.
        </p>
      )}
      {(!items || items.length === 0) ? (
        <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>Nothing to file.</p>
      ) : items.map((item) => (
        <div key={`${item.learnerId}:${item.sessionId}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#374151" }}>
            <strong style={{ fontWeight: 600 }}>{learnerName(item.learner)}</strong> — {sessionLabel(item)}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onFile(item)}
            style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", borderRadius: 7, border: "none", background: busy ? "#b8d9ee" : ACCENT, color: "#fff", cursor: busy ? "not-allowed" : "pointer", flexShrink: 0 }}
          >
            File as not submitted
          </button>
        </div>
      ))}
    </div>
  );
}
