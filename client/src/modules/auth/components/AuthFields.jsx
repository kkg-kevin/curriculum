import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

export function FieldWrap({ label, error, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{label}</label>
      {children}
      {error && <p style={{ margin: 0, fontSize: "12px", color: "#EF4444" }}>{error}</p>}
    </div>
  );
}

export function IconInput({ icon: Icon, error, ...rest }) {
  return (
    <div className="df-input-group">
      <span className="df-input-icon"><Icon size={16} /></span>
      <input className={`df-input${error ? " has-error" : ""}`} {...rest} />
    </div>
  );
}

export function PasswordInput({ icon: Icon, error, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="df-input-group">
      <span className="df-input-icon"><Icon size={16} /></span>
      <input
        type={visible ? "text" : "password"}
        className={`df-input df-input--with-toggle${error ? " has-error" : ""}`}
        {...rest}
      />
      <button
        type="button"
        className="df-toggle-btn"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <FiEyeOff size={16} /> : <FiEye size={16} />}
      </button>
    </div>
  );
}

export function RoleTile({ icon: Icon, label, description, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`df-role-tile${selected ? " selected" : ""}`}
      onClick={onSelect}
    >
      <span className="df-role-tile-icon"><Icon size={18} /></span>
      <span>
        <span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#111827", marginBottom: "2px" }}>
          {label}
        </span>
        <span style={{ display: "block", fontSize: "12.5px", color: "#6B7280", lineHeight: 1.45 }}>
          {description}
        </span>
      </span>
    </button>
  );
}
