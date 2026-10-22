import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";

// Hub check-ins — labels, status looks and the small building blocks every check-ins screen
// shares. Keys match server/src/modules/checkins/checkin.constants.js.

export const T = { accent: "#25476a", accentMid: "#2e7db5", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB", tint: "#F1F9FD" };
export const font = "Inter, sans-serif";
export const card = { background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)" };
export const control = { padding: "8px 10px", borderRadius: 9, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: font, color: "#374151", background: "#fff", outline: "none", minWidth: 0, boxSizing: "border-box" };
export const input = { ...control, width: "100%", padding: "9px 11px" };
export const label = { display: "block", fontSize: 12.5, fontWeight: 700, color: "#374151", marginBottom: 5 };
export const hint = { margin: "4px 0 0", fontSize: 11.5, color: T.inkMuted, lineHeight: 1.5 };
export const chip = (on) => ({ padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${on ? T.accent : T.border}`, background: on ? T.accent : "#fff", color: on ? "#fff" : "#374151", fontSize: 12.5, fontWeight: 700, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap" });
export const primaryBtn = (disabled = false) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", border: 0, borderRadius: 10, background: disabled ? "#9DB3C8" : T.accent, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: font, cursor: disabled ? "not-allowed" : "pointer" });
export const ghostBtn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1.5px solid #D6E4EF", background: "#fff", color: T.accent, fontSize: 13, fontWeight: 600, fontFamily: font, cursor: "pointer" };
export const dangerBtn = { ...ghostBtn, color: "#B91C1C", borderColor: "#FECACA" };

export const FREQUENCY_LABEL = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", semi_annually: "Every 6 months", annually: "Yearly", once: "One-off" };
export const FORMAT_LABEL = { online: "Online", in_person: "In person" };

export const SESSION_STATUS = {
  scheduled: { label: "Scheduled", bg: "#EFF6FF", color: "#1D4ED8" },
  rescheduled: { label: "Rescheduled", bg: "#F5F3FF", color: "#6D28D9" },
  in_progress: { label: "In progress", bg: "#ECFEFF", color: "#0E7490" },
  pending_submission: { label: "Pending submission", bg: "#FFFBEB", color: "#B45309" },
  completed: { label: "Completed", bg: "#ECFDF5", color: "#047857" },
  missed: { label: "Missed", bg: "#FEF2F2", color: "#B91C1C" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", color: "#6B7280" },
};
export const OVERALL_STATUS = {
  on_track: { label: "On track", bg: "#ECFDF5", color: "#047857" },
  needs_attention: { label: "Needs attention", bg: "#FFFBEB", color: "#B45309" },
  critical: { label: "Critical", bg: "#FEF2F2", color: "#B91C1C" },
};
export const OPERATIONAL_STATUS = { running_well: "Running well", minor_issues: "Minor issues", significant_issues: "Significant issues" };
export const ACTION_STATUS = {
  open: { label: "Open", bg: "#FFF7ED", color: "#C2410C" },
  assigned: { label: "Assigned", bg: "#EFF6FF", color: "#1D4ED8" },
  in_progress: { label: "In progress", bg: "#ECFEFF", color: "#0E7490" },
  resolved: { label: "Resolved", bg: "#ECFDF5", color: "#047857" },
  closed: { label: "Closed", bg: "#F3F4F6", color: "#6B7280" },
};
export const PRIORITY = {
  low: { label: "Low", color: "#6B7280" },
  medium: { label: "Medium", color: "#1D4ED8" },
  high: { label: "High", color: "#B45309" },
  critical: { label: "Critical", color: "#B91C1C" },
};
export const CATEGORY_LABEL = {
  equipment: "Equipment", staffing: "Staffing", facilities: "Facilities", curriculum_delivery: "Curriculum delivery",
  educator_support: "Educator support", learner_engagement: "Learner engagement", operations: "Operations", other: "Other",
};
export const KIND_LABEL = { issue: "Issue", action: "Follow-up" };

export function Pill({ look, children }) {
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: look?.bg || "#F3F4F6", color: look?.color || T.inkMuted, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
      {children ?? look?.label}
    </span>
  );
}

export const formatDate = (value, opts = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) => {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString("en-GB", opts);
};
export const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export function Modal({ title, onClose, children, footer, width = 560 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ width: "100%", maxWidth: width, maxHeight: "90vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.25)", fontFamily: font }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 20px 10px" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.ink }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "#F3F4F6", width: 30, height: 30, borderRadius: 8, cursor: "pointer", color: T.inkMuted, display: "flex", alignItems: "center", justifyContent: "center" }}><FiX size={15} /></button>
        </div>
        <div style={{ padding: "6px 20px 16px", overflowY: "auto" }}>{children}</div>
        {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", padding: "12px 20px 18px", borderTop: "1px solid #F3F4F6" }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Empty({ title, children }) {
  return (
    <div style={{ padding: "36px 20px", textAlign: "center", color: T.inkMuted, fontSize: 13.5 }}>
      <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#374151" }}>{title}</p>
      {children && <p style={{ margin: 0 }}>{children}</p>}
    </div>
  );
}

// A person picker from the workspace's admins and staff (GET /api/checkins/people).
export function PersonSelect({ id, value, onChange, people = [], placeholder = "Choose…", onlyCheckins = false, allowEmpty = true }) {
  const list = onlyCheckins ? people.filter((p) => p.canUseCheckins) : people;
  return (
    <select id={id} value={value || ""} onChange={(e) => onChange(e.target.value || null)} style={input}>
      {allowEmpty && <option value="">{placeholder}</option>}
      {list.map((p) => <option key={p.id} value={p.id}>{p.name}{p.roleName ? ` — ${p.roleName}` : ""}</option>)}
    </select>
  );
}

export function Pager({ page, limit, total, onPage }) {
  if (total <= limit) return null;
  const last = Math.ceil(total / limit);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "12px 16px", fontSize: 12.5, color: T.inkMuted }}>
      <span>Page {page} of {last} · {total} in all</span>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} style={{ ...ghostBtn, padding: "5px 10px", opacity: page <= 1 ? 0.5 : 1 }}>Previous</button>
      <button type="button" disabled={page >= last} onClick={() => onPage(page + 1)} style={{ ...ghostBtn, padding: "5px 10px", opacity: page >= last ? 0.5 : 1 }}>Next</button>
    </div>
  );
}
