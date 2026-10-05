import { FiCheck, FiHome, FiMapPin, FiX } from "react-icons/fi";
import api from "../../services/api";

// Shared look and wording for the claims screens — the educator's (teacher-portal) and the
// reviewers' (admin app) — so a claim reads the same way to everyone who handles it.

export const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF",
  border: "#E5E7EB", gold: "#feb139",
};
export const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #EEF1F5" };

const CURRENCY_LABEL = { KES: "KSh" };

export function formatMoney(amount, currency = "KES") {
  return `${CURRENCY_LABEL[currency] || currency} ${Math.round(Number(amount) || 0).toLocaleString("en-KE")}`;
}

// A session rate keeps its decimals (KSh 904.666) — only totals are rounded to the shilling.
export function formatRate(rate, currency = "KES") {
  return `${CURRENCY_LABEL[currency] || currency} ${(Number(rate) || 0).toLocaleString("en-KE", { maximumFractionDigits: 3 })}`;
}

export function formatDate(value) {
  if (!value) return "—";
  // A plain calendar date ("2026-08-10") must not be shifted by the viewer's timezone.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const TYPE_LABEL = { advance: "Advance", full: "Full payment" };

export const CLAIM_STATUS = {
  pending_supervisor: { label: "With supervisor", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  pending_admin: { label: "With admin", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  approved: { label: "Approved — to be paid", bg: "#F0FDFA", color: "#0F766E", border: "#99F6E4" },
  paid: { label: "Paid", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  rejected: { label: "Declined", bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
};

// Where a whole course stands for the educator (server: claim.service.js's buildFigures).
export const COURSE_STAGE = {
  not_started: { label: "Not started", bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  in_progress: { label: "In progress", bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE" },
  ready: { label: "Ready to claim", bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  in_review: { label: "In review", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  approved: { label: "Approved", bg: "#F0FDFA", color: "#0F766E", border: "#99F6E4" },
  paid: { label: "Paid", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
};

export function Pill({ config, size = "medium" }) {
  const compact = size === "small";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: compact ? "3px 9px" : "5px 11px", borderRadius: 999, fontSize: compact ? 11 : 12, fontWeight: 700, whiteSpace: "nowrap", background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
      {config.label}
    </span>
  );
}

export const ClaimStatusPill = ({ status, size }) => <Pill config={CLAIM_STATUS[status] || CLAIM_STATUS.pending_supervisor} size={size} />;
export const CourseStagePill = ({ stage, size }) => <Pill config={COURSE_STAGE[stage] || COURSE_STAGE.not_started} size={size} />;

// The uploaded invoice is stored as a path on the API server, not on this app's own origin.
export function invoiceHref(claim) {
  return claim?.invoiceUrl ? new URL(claim.invoiceUrl, api.defaults.baseURL).toString() : null;
}

const HUB_TYPE_LABEL = { school: "School", co_working_space: "Co-working space", innovation_lab: "Innovation lab", makerspace: "Makerspace", tech_club: "Tech club" };

// The chip that says where a course is taught: at a learner's home, or at which kind of hub.
export function LocationChip({ hub }) {
  if (!hub) return null;
  const home = hub.isHomeLearning;
  const Icon = home ? FiHome : FiMapPin;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: home ? "#FFF7ED" : T.accent, color: home ? "#C2410C" : "#fff" }}>
      <Icon size={11} /> {home ? "Home" : HUB_TYPE_LABEL[hub.hubType] || "Hub"}
    </span>
  );
}

export function ProgressRing({ percent, size = 76, stroke = 7 }) {
  const value = Math.max(0, Math.min(100, percent || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = value >= 100 ? "#16A34A" : T.accentLight;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF2F7" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} style={{ transition: "stroke-dashoffset 0.4s ease" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: size * 0.22, fontWeight: 800, color: T.ink }}>{value}%</span>
    </div>
  );
}

export function ProgressBar({ percent, color = T.accentLight }) {
  const value = Math.max(0, Math.min(100, percent || 0));
  return (
    <div style={{ height: 6, borderRadius: 999, background: "#EEF2F7", overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", borderRadius: 999, background: value >= 100 ? "#16A34A" : color, transition: "width 0.4s ease" }} />
    </div>
  );
}

// A claim's journey as a row of steps: submitted → reviewed → paid. The review is the
// supervisor's when the educator has one, otherwise the admin's. A declined claim stops there.
export function ClaimTimeline({ claim }) {
  const viaSupervisor = Boolean(claim.supervisorId || claim.supervisorDecidedAt || claim.rejectedStage === "supervisor");
  const decidedAt = viaSupervisor ? claim.supervisorDecidedAt : claim.adminDecidedAt;
  const reviewer = (viaSupervisor ? claim.supervisorName : claim.adminName) || (viaSupervisor ? "Supervisor" : "Admin");
  const declined = claim.status === "rejected";
  const waitingForPay = claim.status === "approved";
  const steps = [
    { key: "submitted", label: "Submitted", detail: formatDate(claim.createdAt), state: "done" },
    {
      key: "review",
      label: viaSupervisor ? "Supervisor" : "Admin",
      detail: decidedAt ? `${reviewer} · ${formatDate(decidedAt)}` : viaSupervisor && claim.supervisorName ? `Waiting · ${claim.supervisorName}` : "Waiting",
      state: declined ? "declined" : decidedAt || waitingForPay || claim.status === "paid" ? "done" : "current",
    },
    {
      key: "paid",
      label: "Paid",
      detail: claim.paidAt ? formatDate(claim.paidAt) : waitingForPay ? "Waiting · admin" : "—",
      state: claim.status === "paid" ? "done" : waitingForPay ? "current" : "todo",
    },
  ];
  const look = {
    done: { bg: "#16A34A", color: "#fff", border: "#16A34A" },
    current: { bg: "#fff", color: T.accentMid, border: T.accentLight },
    declined: { bg: "#DC2626", color: "#fff", border: "#DC2626" },
    todo: { bg: "#fff", color: T.inkFaint, border: T.border },
    skipped: { bg: "#fff", color: T.inkFaint, border: T.border },
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: 4 }}>
      {steps.map((step, index) => {
        const s = look[step.state];
        return (
          <div key={step.key} style={{ position: "relative", textAlign: "center", minWidth: 0 }}>
            {index > 0 && <div style={{ position: "absolute", top: 11, right: "50%", width: "100%", height: 2, background: step.state === "done" || step.state === "declined" || step.state === "current" ? "#BBE3C8" : T.border }} />}
            <div style={{ position: "relative", width: 24, height: 24, margin: "0 auto", borderRadius: "50%", display: "grid", placeItems: "center", background: s.bg, color: s.color, border: `2px solid ${s.border}`, fontSize: 11, fontWeight: 800 }}>
              {step.state === "done" ? <FiCheck size={13} /> : step.state === "declined" ? <FiX size={13} /> : index + 1}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, fontWeight: 700, color: step.state === "todo" || step.state === "skipped" ? T.inkFaint : T.ink }}>{step.label}</p>
            <p style={{ margin: "1px 0 0", fontSize: 10.5, color: T.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={step.detail}>{step.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

export const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13.5, fontFamily: "Inter, sans-serif", color: T.ink, outline: "none", background: "#fff" };

export const primaryButton = (disabled) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 18px", borderRadius: 10, border: "none",
  background: disabled ? "#AAB6C3" : T.accent, color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: disabled ? "not-allowed" : "pointer",
});

export const ghostButton = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", color: T.ink, fontSize: 13.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" };

// A centred dialog over a dimmed page. Closes on the backdrop or the × — but not while `busy`,
// so a request in flight can't be orphaned by a stray click.
export function Dialog({ title, subtitle, onClose, busy = false, width = 560, children }) {
  return (
    <div role="presentation" onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", overflowY: "auto", fontFamily: "Inter, sans-serif" }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: width, background: "#F8FAFC", borderRadius: 18, boxShadow: "0 24px 70px rgba(15,23,42,0.3)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "18px 22px", background: "#fff", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.ink }}>{title}</h2>
            {subtitle && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.inkMuted }}>{subtitle}</p>}
          </div>
          <button type="button" onClick={() => !busy && onClose()} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.border}`, background: "#fff", color: T.inkMuted, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <FiX size={16} />
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}
