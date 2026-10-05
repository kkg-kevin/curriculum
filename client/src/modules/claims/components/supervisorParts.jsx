import { FiArrowRight, FiFileText } from "react-icons/fi";
import { ClaimStatusPill, ProgressBar, T, TYPE_LABEL, cardStyle, formatMoney } from "../shared";

// Pieces the supervisor's pages share (dashboard, claims, educators): how a claim is drawn as a
// card, how long it has waited, and the small avatar/stat building blocks.

export const initialsOf = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";

export function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// "today", "yesterday", "3 days ago" — how long a claim has been sitting.
export function daysSince(value) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000)));
}
export const ago = (days) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

// A claim nobody has decided after this many days is flagged as waiting too long.
export const OVERDUE_DAYS = 3;
export function Avatar({ name, photo, size = 40 }) {
  return photo ? (
    <img src={photo} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  ) : (
    <span style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #2e7db5, #25476a)", color: "#fff", fontSize: size * 0.36, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0 }}>{initialsOf(name)}</span>
  );
}

export function HeroStat({ icon: Icon, value, label, sub }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase" }}><Icon size={14} /> {label}</div>
      <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.72)", fontVariantNumeric: "tabular-nums" }}>{sub}</p>
    </div>
  );
}

// What the educator's records looked like when they claimed — a quick read before opening it.
export function RecordChip({ label, done, of }) {
  if (!of) return null;
  const complete = done >= of;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", background: complete ? "#ECFDF5" : "#FFF7ED", color: complete ? "#047857" : "#C2410C" }}>
      {label} {done}/{of}
    </span>
  );
}

export function ClaimCard({ claim, onOpen }) {
  const waiting = claim.status === "pending_supervisor";
  const days = daysSince(claim.createdAt);
  const percent = claim.sessionsTotal > 0 ? Math.round((claim.sessionsDelivered / claim.sessionsTotal) * 100) : 0;
  const evidence = claim.evidence || {};
  return (
    <button type="button" onClick={onOpen} className="supervisor-claim" style={{ ...cardStyle, width: "100%", padding: 18, textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 14, borderLeft: `4px solid ${waiting ? T.gold : "#E5E7EB"}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <Avatar name={claim.teacherName} size={44} />
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: T.ink }}>{claim.teacherName}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[claim.courseName, claim.className, claim.hubName].filter(Boolean).join(" · ")}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: T.accent, letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>{formatMoney(claim.amount, claim.currency)}</p>
          <p style={{ margin: "1px 0 0", fontSize: 12, fontWeight: 700, color: T.inkMuted }}>{TYPE_LABEL[claim.type]}</p>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, fontSize: 12, color: T.inkMuted }}>
          <span>Sessions delivered</span>
          <strong style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>{claim.sessionsDelivered} of {claim.sessionsTotal}</strong>
        </div>
        <ProgressBar percent={percent} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <RecordChip label="Attendance" done={evidence.attendanceMarked} of={evidence.sessionsDelivered} />
        <RecordChip label="Graded" done={evidence.assignmentsGraded} of={evidence.assignmentsExpected} />
        <RecordChip label="Reports" done={evidence.reportsDone} of={evidence.reportsExpected} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: T.inkMuted }}><FiFileText size={12} /> {claim.claimNumber}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
          {waiting ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: days >= OVERDUE_DAYS ? "#B91C1C" : T.inkMuted }}>Sent {ago(days)}</span>
          ) : (
            <ClaimStatusPill status={claim.status} size="small" />
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 800, background: waiting ? T.accent : "#F1F5F9", color: waiting ? "#fff" : T.accent }}>
            {waiting ? "Review" : "View"} <FiArrowRight size={14} />
          </span>
        </span>
      </div>
    </button>
  );
}
