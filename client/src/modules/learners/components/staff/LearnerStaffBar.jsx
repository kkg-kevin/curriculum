import { FiEye, FiEyeOff, FiEdit3, FiTrash2, FiPower } from "react-icons/fi";
import { T, cardStyle } from "../../../learner-portal/components/profile/theme";

const buttonStyle = (tone, disabled) => {
  const tones = {
    plain:  { color: T.accent,  border: T.tintBorder, bg: "#fff" },
    active: { color: "#fff",    border: T.accent,     bg: T.accent },
    danger: { color: "#B91C1C", border: "#FECACA",    bg: "#fff" },
    good:   { color: "#047857", border: "#A7F3D0",    bg: "#fff" },
  };
  const t = tones[tone];
  return {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
    border: `1.5px solid ${t.border}`, backgroundColor: t.bg, color: t.color,
    fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, whiteSpace: "nowrap",
  };
};

// The top of the staff learner page: the way back to the list, the account's state, and every
// action on the record as a whole. Edits to the details themselves happen in place, on the cards
// below. Actions the caller can't take are left out (their handler isn't passed).
export default function LearnerStaffBar({
  learner, onBack, preview, onTogglePreview,
  accountStatus, onToggleAccount, accountTogglePending,
  onOpenFullForm, onRemove, removeLabel,
}) {
  const active = accountStatus === "active";
  // A website sign-up stays switched off until its invoice is paid.
  const awaitingPayment = accountStatus === "pending_payment";
  return (
    <div style={{ ...cardStyle(), padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        <button type="button" onClick={onBack} style={{ padding: 0, background: "none", border: "none", color: T.inkMuted, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Learners
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{learner.firstName} {learner.lastName}</span>
        <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, backgroundColor: active ? "#ECFDF5" : awaitingPayment ? "#FFFBEB" : "#FEF2F2", color: active ? "#047857" : awaitingPayment ? "#B45309" : "#B91C1C", border: `1px solid ${active ? "#A7F3D0" : awaitingPayment ? "#FDE68A" : "#FECACA"}` }}>
          {awaitingPayment ? "Waiting for payment" : `Account ${active ? "active" : "inactive"}`}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={onTogglePreview} aria-pressed={preview} style={buttonStyle(preview ? "active" : "plain")}>
          {preview ? <FiEyeOff size={14} /> : <FiEye size={14} />} {preview ? "Back to managing" : "Preview as learner"}
        </button>
        {!preview && onToggleAccount && (
          <button type="button" onClick={onToggleAccount} disabled={accountTogglePending} style={buttonStyle(active ? "danger" : "good", accountTogglePending)}>
            <FiPower size={14} /> {active ? "Deactivate" : "Activate"}
          </button>
        )}
        {!preview && onOpenFullForm && (
          <button type="button" onClick={onOpenFullForm} style={buttonStyle("plain")}>
            <FiEdit3 size={14} /> Full form
          </button>
        )}
        {!preview && onRemove && (
          <button type="button" onClick={onRemove} style={buttonStyle("danger")}>
            <FiTrash2 size={14} /> {removeLabel}
          </button>
        )}
      </div>
    </div>
  );
}
