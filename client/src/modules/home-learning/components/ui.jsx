// Styles and formatters shared by the Home Learning admin page and its household cards.
export const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #D1D5DB", borderRadius: 9, padding: "10px 12px", fontSize: 14, background: "#fff" };
export const labelStyle = { display: "grid", gap: 6, color: "#374151", fontSize: 13, fontWeight: 600 };
export const panelStyle = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 22, boxShadow: "0 2px 8px rgba(15,23,42,.04)" };
export const primaryButton = { border: 0, borderRadius: 9, padding: "11px 16px", color: "white", background: "#25476a", fontWeight: 700, cursor: "pointer" };
export const secondaryButton = { border: "1px solid #D1D5DB", borderRadius: 7, color: "#4B5563", background: "#fff", padding: "7px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 };

export const formatMoney = (amount) => `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;
export const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "");
export const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");
export const thisMonth = () => new Date().toISOString().slice(0, 7);
export const errorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;

export const HOUSEHOLD_STATUS = {
  active: { label: "Active", color: "#047857", background: "#ECFDF5" },
  pending: { label: "Pending", color: "#B45309", background: "#FFFBEB" },
  paused: { label: "Paused", color: "#4B5563", background: "#F3F4F6" },
  cancelled: { label: "Cancelled", color: "#B91C1C", background: "#FEF2F2" },
};

export const ENROLLMENT_STATUS = {
  active: { label: "Active", color: "#047857", background: "#ECFDF5" },
  paused: { label: "Paused", color: "#4B5563", background: "#F3F4F6" },
  completed: { label: "Completed", color: "#1D4ED8", background: "#EFF6FF" },
  removed: { label: "Removed", color: "#6B7280", background: "#F3F4F6" },
};

export function Pill({ tone, children }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: tone.color, background: tone.background, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>{children}</span>;
}

// Initials badge (or photo) for a guardian or child.
export function Initials({ name = "", photo, size = 44 }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
  const box = { width: size, height: size, borderRadius: "50%", flexShrink: 0 };
  if (photo) return <img src={photo} alt="" style={{ ...box, objectFit: "cover" }} />;
  return <div aria-hidden style={{ ...box, display: "grid", placeItems: "center", background: "#E8F5FB", color: "#25476a", fontWeight: 800, fontSize: Math.round(size * 0.36) }}>{initials}</div>;
}
