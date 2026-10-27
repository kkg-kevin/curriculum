import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { FiX } from "react-icons/fi";

// Hub check-ins — labels, status looks and the small building blocks every check-ins screen
// shares. Keys match server/src/modules/checkins/checkin.constants.js.

// Where the check-ins pages live: the admin app (/checkins), or the hub portal for a hub's
// Account Manager / Training Lead (/school-portal/checkins).
export const checkinsBaseFor = (pathname) => (pathname.startsWith("/school-portal") ? "/school-portal/checkins" : "/checkins");
export function useCheckinsBase() {
  return checkinsBaseFor(useLocation().pathname);
}

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

// The four the admin chooses from; "quarterly" and "once" only for schedules set up before 26 Oct 2026.
export const FREQUENCY_OPTIONS = ["weekly", "monthly", "semi_annually", "annually"];
export const FREQUENCY_LABEL = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", semi_annually: "Every 6 months", annually: "Yearly", once: "One-off" };
export const FORMAT_LABEL = { online: "Online", in_person: "In person" };

// Where a check-in stands (server: checkin.rules.js's sessionState).
export const STATE = {
  upcoming: { label: "Upcoming", bg: "#EFF6FF", color: "#1D4ED8" },
  due: { label: "Report due", bg: "#FFFBEB", color: "#B45309" },
  reported: { label: "Reported", bg: "#ECFDF5", color: "#047857" },
};

// The report's three parts, in order.
export const REPORT_PARTS = [
  { key: "highs", label: "Highs", help: "What went well — progress, wins, what's working." },
  { key: "lows", label: "Lows", help: "What didn't — problems, gaps, concerns." },
  { key: "resolutions", label: "Resolutions", help: "What was agreed to do about them, and by whom." },
];

// Where a task from the resolutions stands (server: checkin.rules.js's taskState).
export const TASK_STATE = {
  open: { label: "Open", bg: "#EFF6FF", color: "#1D4ED8" },
  due: { label: "Due today", bg: "#FFFBEB", color: "#B45309" },
  overdue: { label: "Overdue", bg: "#FEF2F2", color: "#B91C1C" },
  done: { label: "Done", bg: "#ECFDF5", color: "#047857" },
};

// The hub's own login in the hub portal (not as its Account Manager / Training Lead): it reads its
// own check-ins and their reports, and writes nothing.
export const isHubViewer = (user) => user?.role === "school" && !user?.hubLead;

// A report part as HTML. Parts are rich text since 27 Oct 2026; earlier ones are plain text, whose
// line breaks become paragraphs here (for showing, and for opening in the editor).
export function reportHtml(value) {
  const text = String(value || "");
  if (!text.trim() || /<\/?[a-z][^>]*>/i.test(text)) return text;
  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split(/\n{2,}/).map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`).join("");
}

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
