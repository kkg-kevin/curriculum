import { useState } from "react";
import { useRosterForIssue, useReissueAssessment, useRevokeIssue, useRevokeForLearners } from "../../assessments/hooks/useAssessmentSubmission";

// Choosing learners for an issued assessment — the same checklist everywhere: an "everyone" box on
// top, then one box per learner. Used by the roster page (Reissue… / Revoke…), the Assessments
// page (Revoke, and Issue to chosen learners).

export const T = { accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
export const fullName = (l) => `${l?.firstName || ""} ${l?.lastName || ""}`.trim();
export const inputStyle = { padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink, background: "#fff", minWidth: 0 };

export const STATUS_CONFIG = {
  not_started: { label: "Not Started", bg: "#F9FAFB", color: T.inkMuted, border: T.border },
  in_progress: { label: "In Progress", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  submitted:   { label: "Needs Grading", bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  graded:      { label: "Graded", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};

export function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1.5px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// Why this roster row can't be reissued right now, or null. The server works it out with the same
// rule it enforces (reissue.rules.js) and sends it on each roster row; the fallback below is only
// for a server too old to send it.
export function reissueBlockerOf(row) {
  if (row.reissueBlocker !== undefined) return row.reissueBlocker;
  if (row.revokedAt) return "Revoked — give it back first";
  const attempts = row.attempts?.length ? row.attempts : [{ issueId: row.issueId, submission: row.submission }];
  const latest = attempts[attempts.length - 1].submission;
  const firstAttempt = attempts.length === 1;
  if (latest.groupId) return "Group work";
  if (latest.status === "not_started" || latest.status === "in_progress") return firstAttempt ? "Hasn't handed it in yet" : "Reissue waiting for them";
  if (latest.status !== "graded") return "Mark their latest attempt first";
  return null;
}

// The checklist. `rows` are { learner, submission? }; a row whose `blockerOf` gives a reason can't be
// ticked and says why. `everyone` (optional) is the box on top: { label, hint, checked, onChange,
// locked } — while it's ticked every learner shows ticked. `showStatus` adds each one's progress.
export function LearnerChecklist({ rows, picked, onToggle, blockerOf = () => null, everyone, showStatus = true }) {
  const all = !!everyone?.checked;
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, maxHeight: 340, overflowY: "auto" }}>
      {everyone && (
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderBottom: `1px solid ${T.border}`, background: T.tintBg, cursor: everyone.locked ? "not-allowed" : "pointer", position: "sticky", top: 0, zIndex: 1 }}>
          <input type="checkbox" checked={all} disabled={!!everyone.locked} onChange={(e) => everyone.onChange(e.target.checked)} style={{ marginTop: 3 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.ink }}>{everyone.label}</span>
            {everyone.hint && <span style={{ display: "block", fontSize: 11.5, color: T.inkMuted, lineHeight: 1.45 }}>{everyone.hint}</span>}
          </span>
        </label>
      )}
      {rows.length === 0 && <p style={{ margin: 0, padding: "14px 12px", fontSize: 12.5, color: T.inkFaint }}>No learners in this class yet.</p>}
      {rows.map((row) => {
        const blocker = blockerOf(row);
        const disabled = all || !!blocker;
        const checked = blocker ? false : all || picked.has(row.learner.id);
        return (
          <label key={row.learner.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid #F3F4F6", cursor: disabled ? "not-allowed" : "pointer", opacity: blocker ? 0.6 : 1 }}>
            <input type="checkbox" disabled={disabled} checked={checked} onChange={() => onToggle(row.learner.id)} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.ink }}>{fullName(row.learner)}</span>
              {blocker && <span style={{ display: "block", fontSize: 11.5, color: T.inkMuted }}>{blocker}</span>}
            </span>
            {showStatus && !blocker && row.submission && <StatusBadge status={row.submission.status} />}
          </label>
        );
      })}
    </div>
  );
}

export function usePicked(initial = []) {
  const [picked, setPicked] = useState(() => new Set(initial));
  const toggle = (id) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return [picked, toggle, setPicked];
}

export function Dialog({ title, children, onClose }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1300 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 16, padding: "20px 22px", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 14, boxSizing: "border-box" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.ink }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function DialogButtons({ onClose, onConfirm, confirmLabel, disabled, danger }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={onClose} style={{ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", color: T.inkMuted, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Cancel</button>
      <button type="button" disabled={disabled} onClick={onConfirm} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: disabled ? "#D1D5DB" : danger ? "#DC2626" : T.accent, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: disabled ? "not-allowed" : "pointer" }}>{confirmLabel}</button>
    </div>
  );
}

const hintStyle = { margin: 0, fontSize: 13, color: T.inkMuted, lineHeight: 1.55 };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Reissue: tick learners (or "everyone who can"); each gets a fresh attempt that replaces the
// earlier one on their list. Only those whose latest attempt is marked can be ticked.
export function ReissueDialog({ issueId, roster, initialIds = [], onClose }) {
  const { mutate: reissue, isPending } = useReissueAssessment();
  const eligible = roster.filter((r) => !reissueBlockerOf(r));
  const [picked, toggle] = usePicked(initialIds.filter((id) => eligible.some((r) => r.learner.id === id)));
  const [everyone, setEveryone] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const chosenIds = everyone ? eligible.map((r) => r.learner.id) : [...picked];
  return (
    <Dialog title="Reissue to learners" onClose={onClose}>
      <p style={hintStyle}>Each learner you tick gets a fresh attempt. It replaces the earlier one on their list; their earlier work and your feedback stay here on the roster, and they see your feedback as guidance.</p>
      <LearnerChecklist
        rows={roster}
        picked={picked}
        onToggle={toggle}
        blockerOf={reissueBlockerOf}
        everyone={{
          label: `Everyone who can have another try (${eligible.length})`,
          hint: eligible.length ? "Learners whose latest attempt is marked." : "Nobody's latest attempt is marked yet.",
          checked: everyone,
          locked: !eligible.length,
          onChange: setEveryone,
        }}
      />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: T.inkMuted, flex: "1 1 180px" }}>
          Due date (optional)
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: T.inkMuted, flex: "1 1 140px" }}>
          Time limit, minutes (optional)
          <input type="number" min={1} max={1440} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} style={inputStyle} />
        </label>
      </div>
      <DialogButtons
        onClose={onClose}
        disabled={!chosenIds.length || isPending}
        confirmLabel={isPending ? "Reissuing…" : chosenIds.length ? `Reissue to ${plural(chosenIds.length, "learner")}` : "Reissue"}
        onConfirm={() => reissue(
          { issueId, learnerIds: chosenIds, dueDate: dueDate || null, timeLimitMinutes: Number(timeLimit) > 0 ? Math.min(1440, Math.round(Number(timeLimit))) : null },
          { onSuccess: onClose },
        )}
      />
    </Dialog>
  );
}

// Revoke: tick learners, or "everyone" (the class issue goes — learners who join later don't get
// it either). A group assessment is revoked for everyone only.
export function RevokeDialog({ issueId, roster, isGroupMode, chosenOnly = false, handedInCount = 0, initialIds = [], onClose, onRevokedAll }) {
  const { mutate: revokeLearners, isPending: revokingSome } = useRevokeForLearners();
  const { mutate: revokeAll, isPending: revokingAll } = useRevokeIssue();
  const [picked, toggle] = usePicked(initialIds);
  const [everyone, setEveryone] = useState(false);
  const all = isGroupMode || everyone;
  const pending = revokingSome || revokingAll;
  return (
    <Dialog title="Revoke this assessment" onClose={onClose}>
      <p style={hintStyle}>
        {all
          ? `It leaves every learner's list, as if it was never issued${chosenOnly ? "" : " — learners who join later won't get it either"}.${handedInCount ? ` ${handedInCount} handed in — that work is kept but no longer counts.` : ""} The session still asks for it: issue it again, or mark it not submitted in the class’s Year Completion.`
          : "It leaves only the ticked learners' lists and is no longer asked of them. Their work is kept but stops counting; you can give it back."}
      </p>
      <LearnerChecklist
        rows={roster}
        picked={picked}
        onToggle={toggle}
        blockerOf={(row) => (row.revokedAt ? "Already revoked" : null)}
        everyone={{
          label: chosenOnly ? "Everyone it was issued to" : "Everyone in the class",
          hint: isGroupMode ? "A group assessment is shared work, so it's revoked for the whole class." : "Takes the assessment off the class altogether.",
          checked: all,
          locked: isGroupMode,
          onChange: setEveryone,
        }}
      />
      <DialogButtons
        onClose={onClose}
        danger
        disabled={(!all && !picked.size) || pending}
        confirmLabel={pending ? "Revoking…" : all ? "Revoke for everyone" : `Revoke for ${plural(picked.size, "learner")}`}
        onConfirm={() => (all
          ? revokeAll(issueId, { onSuccess: onRevokedAll || onClose })
          : revokeLearners({ issueId, learnerIds: [...picked] }, { onSuccess: onClose }))}
      />
    </Dialog>
  );
}

// The same Revoke dialog opened from outside the roster page — loads the issue's roster itself.
export function RevokeIssueDialog({ issueId, onClose }) {
  const { data, isLoading } = useRosterForIssue(issueId);
  if (isLoading || !data) {
    return <Dialog title="Revoke this assessment" onClose={onClose}><p style={hintStyle}>{isLoading ? "Loading learners…" : "This issue couldn't be loaded."}</p></Dialog>;
  }
  const handedIn = (data.roster || []).filter((r) => !["not_started", "in_progress"].includes(r.submission?.status)).length;
  return (
    <RevokeDialog
      issueId={data.issue.id}
      roster={data.roster || []}
      isGroupMode={!!data.issue.groupMode}
      chosenOnly={Array.isArray(data.issue.forLearnerIds)}
      handedInCount={handedIn}
      onClose={onClose}
    />
  );
}
