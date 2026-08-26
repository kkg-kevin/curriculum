// Single source of truth for the small style/format primitives every billing page was
// independently re-declaring — they'd already drifted (three different date formats across
// pages) before this existed.
export const cardStyle = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14 };
export const buttonStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", border: 0, borderRadius: 8, background: "#25476a", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 };
export const inputStyle = { padding: "10px 12px", border: "1px solid #D7DEE8", borderRadius: 8, fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };

export function formatMoney(amount, currency = "KES") {
  return `${currency} ${Number(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value, fallback = "Not set") {
  return value ? new Date(value).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : fallback;
}

export function formatAddress(address) {
  if (!address) return null;
  return [address.street, address.city, address.county].filter(Boolean).join(", ") || null;
}

// Subtle "this is clickable" affordance for list rows across Billing/Receipts — same technique
// already used for Settings' catalog cards, just inline since there's no shared CSS class layer.
export const rowHoverHandlers = {
  onMouseEnter: (e) => { e.currentTarget.style.background = "#F8FAFC"; },
  onMouseLeave: (e) => { e.currentTarget.style.background = "transparent"; },
};
