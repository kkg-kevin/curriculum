import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiMinus, FiXCircle } from "react-icons/fi";
import { T, cardStyle, formatDate } from "../shared";

// The record behind a claim, one session at a time: for every student, how attendance was
// marked, whether their assignment was graded and whether their report is done. Read-only — the
// same view for the educator and for whoever reviews their claim; the marking and grading
// themselves happen on the Attendance, Assessments and Reports pages.

const ATTENDANCE = {
  present: { label: "Present", bg: "#ECFDF5", color: "#047857" },
  late: { label: "Late", bg: "#FFFBEB", color: "#B45309" },
  absent: { label: "Absent", bg: "#FEF2F2", color: "#B91C1C" },
  excused: { label: "Excused", bg: "#F5F3FF", color: "#6D28D9" },
};

const ASSIGNMENT = {
  graded: { label: "Graded", bg: "#ECFDF5", color: "#047857", Icon: FiCheckCircle },
  partial: { label: "Partly graded", bg: "#FFFBEB", color: "#B45309", Icon: FiClock },
  pending: { label: "Not graded", bg: "#FEF2F2", color: "#B91C1C", Icon: FiXCircle },
  none: { label: "None set", bg: "#F9FAFB", color: "#9CA3AF", Icon: FiMinus },
};

const REPORT = {
  done: { label: "Done", bg: "#ECFDF5", color: "#047857", Icon: FiCheckCircle },
  not_submitted: { label: "Closed — no work", bg: "#F5F3FF", color: "#6D28D9", Icon: FiCheckCircle },
  pending: { label: "Not done", bg: "#FEF2F2", color: "#B91C1C", Icon: FiXCircle },
  none: { label: "Not needed", bg: "#F9FAFB", color: "#9CA3AF", Icon: FiMinus },
};

const SESSION_STATE = {
  delivered: { label: "Delivered", color: "#047857", dot: "#16A34A" },
  cancelled: { label: "Cancelled", color: "#B91C1C", dot: "#DC2626" },
  upcoming: { label: "Upcoming", color: "#6B7280", dot: "#CBD5E1" },
  unscheduled: { label: "Not scheduled", color: "#9CA3AF", dot: "#E5E7EB" },
};

function Chip({ config }) {
  const { Icon } = config;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", background: config.bg, color: config.color }}>
      {Icon && <Icon size={12} />} {config.label}
    </span>
  );
}

function Metric({ label, value, empty }) {
  const done = value === 100;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, fontSize: 12, border: `1px solid ${done ? "#A7F3D0" : T.tintBorder}`, background: done ? "#ECFDF5" : T.tintBg, color: T.inkMuted, whiteSpace: "nowrap" }}>
      {label}
      <strong style={{ color: value == null ? T.inkFaint : done ? "#047857" : T.accentMid, fontWeight: 800 }}>{value == null ? empty : `${value}%`}</strong>
    </span>
  );
}

const initials = (learner) => `${learner.firstName?.[0] || ""}${learner.lastName?.[0] || ""}`.toUpperCase();

export default function SessionEvidence({ course }) {
  const sessions = course.sessions || [];
  // Open on the latest session that has actually run — that's where the freshest records are.
  const startIndex = useMemo(() => {
    let last = 0;
    sessions.forEach((s, i) => { if (s.state === "delivered") last = i; });
    return last;
  }, [sessions]);
  const [index, setIndex] = useState(startIndex);
  useEffect(() => { setIndex(startIndex); }, [course.classId, course.courseId, startIndex]);

  const learnerById = useMemo(() => new Map((course.learners || []).map((l) => [l.id, l])), [course.learners]);
  const session = sessions[Math.min(index, sessions.length - 1)];

  if (!session) {
    return (
      <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>This course has no sessions yet</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>Sessions appear here once the course content has them.</p>
      </div>
    );
  }

  const state = SESSION_STATE[session.state];
  const delivered = session.state === "delivered";
  const navButton = (disabled) => ({ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.border}`, background: "#fff", color: disabled ? "#D1D5DB" : T.ink, cursor: disabled ? "default" : "pointer", display: "grid", placeItems: "center" });

  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.border}`, background: "#F8FBFE" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>Session {session.number}{session.title ? ` · ${session.title}` : ""}</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: T.inkMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: state.dot }} />
              <span style={{ color: state.color, fontWeight: 700 }}>{state.label}</span>
              {session.date && <span>· {formatDate(session.date)}</span>}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" aria-label="Previous session" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} style={navButton(index === 0)}><FiChevronLeft size={16} /></button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkMuted, fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "center" }}>{session.number} / {sessions.length}</span>
            <button type="button" aria-label="Next session" disabled={index >= sessions.length - 1} onClick={() => setIndex((i) => Math.min(sessions.length - 1, i + 1))} style={navButton(index >= sessions.length - 1)}><FiChevronRight size={16} /></button>
          </div>
        </div>

        {/* One dot per session — the whole course at a glance, and a way to jump straight to one. */}
        <div style={{ display: "flex", gap: 5, marginTop: 12, flexWrap: "wrap" }}>
          {sessions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              title={`Session ${s.number} — ${SESSION_STATE[s.state].label}${s.date ? `, ${formatDate(s.date)}` : ""}`}
              onClick={() => setIndex(i)}
              style={{ width: 26, height: 26, borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "Inter, sans-serif", border: i === index ? `2px solid ${T.accent}` : "2px solid transparent", background: s.state === "delivered" ? "#DCFCE7" : s.state === "cancelled" ? "#FEE2E2" : "#EEF2F7", color: s.state === "delivered" ? "#166534" : s.state === "cancelled" ? "#991B1B" : T.inkFaint }}
            >
              {s.number}
            </button>
          ))}
        </div>

        {delivered && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Metric label="Attendance" value={session.attendancePercent} empty={session.attendanceLocked ? "Closed unmarked" : "Not marked"} />
            <Metric label="Assignment" value={session.assignmentPercent} empty="None set" />
            <Metric label="Report" value={session.reportPercent} empty="Not needed" />
          </div>
        )}
      </div>

      {!delivered ? (
        <p style={{ margin: 0, padding: "34px 24px", textAlign: "center", fontSize: 13, color: T.inkMuted }}>
          {session.state === "cancelled" ? "This session was cancelled, so there are no records for it and it isn't paid for." : "This session hasn't happened yet — its records will show here once it has."}
        </p>
      ) : course.learners.length === 0 ? (
        <p style={{ margin: 0, padding: "34px 24px", textAlign: "center", fontSize: 13, color: T.inkMuted }}>No students are enrolled in this class.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr style={{ background: "#EEF4FA" }}>
                {["Student", "Attendance", "Assignment", "Report"].map((heading, i) => (
                  <th key={heading} style={{ padding: "11px 16px", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.accent, textAlign: i === 0 ? "left" : "center" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {session.learners.map((row) => {
                const learner = learnerById.get(row.learnerId);
                if (!learner) return null;
                const attendance = ATTENDANCE[row.attendance];
                return (
                  <tr key={row.learnerId} style={{ borderTop: `1px solid #F1F5F9` }}>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 30, height: 30, borderRadius: "50%", background: T.accent, color: "#fff", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0 }}>{initials(learner)}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{learner.firstName} {learner.lastName}</span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "center" }}>
                      {attendance ? <Chip config={attendance} /> : <Chip config={{ label: "Not marked", bg: "#F9FAFB", color: "#9CA3AF", Icon: FiMinus }} />}
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "center" }}><Chip config={ASSIGNMENT[row.assignment]} /></td>
                    <td style={{ padding: "11px 16px", textAlign: "center" }}><Chip config={REPORT[row.report]} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
