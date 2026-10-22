import { useState } from "react";
import { FiChevronRight } from "react-icons/fi";
import { roleMeta } from "../roles";

// Right after signing in, for a login that holds more than one role: one card per role. `onChoose`
// gets the role and may be async (switching the session); the chosen card shows it's working.
export default function RoleChooser({ name, roles, onChoose, onCancel }) {
  const [busy, setBusy] = useState(null);

  const choose = async (role) => {
    if (busy) return;
    setBusy(role);
    try {
      await onChoose(role);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 800, color: "#111827" }}>How do you want to sign in?</h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
          {name ? `${name}, your` : "Your"} account has more than one role. You can switch later from the top bar.
        </p>
      </div>

      <div role="list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {roles.map((role) => {
          const meta = roleMeta(role);
          const Icon = meta.icon;
          const working = busy === role;
          return (
            <button
              key={role}
              type="button"
              role="listitem"
              onClick={() => choose(role)}
              disabled={!!busy}
              className="df-role-option"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                width: "100%",
                padding: "14px 16px",
                borderRadius: "14px",
                border: `1.5px solid ${working ? "#25476a" : "#E5E7EB"}`,
                background: working ? "#F1F7FC" : "#fff",
                cursor: busy ? "default" : "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                opacity: busy && !working ? 0.55 : 1,
                transition: "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
              }}
            >
              <span style={{ width: "42px", height: "42px", borderRadius: "12px", display: "grid", placeItems: "center", flexShrink: 0, background: "linear-gradient(135deg, #38aae1 0%, #25476a 100%)", color: "#fff" }}>
                <Icon size={20} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "15px", fontWeight: 800, color: "#111827" }}>{meta.label}</span>
                <span style={{ display: "block", fontSize: "12.5px", color: "#6B7280", marginTop: "2px" }}>{working ? "Opening…" : meta.hint}</span>
              </span>
              <FiChevronRight size={18} color="#9CA3AF" style={{ flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      {onCancel && (
        <button type="button" onClick={onCancel} disabled={!!busy} className="df-link" style={{ display: "block", margin: "18px auto 0", background: "none", border: "none", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
          Sign in with a different account
        </button>
      )}
    </div>
  );
}
