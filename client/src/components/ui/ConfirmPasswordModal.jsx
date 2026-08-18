import { useState } from "react";
import { createPortal } from "react-dom";

// Generic "prove it's really you" gate — re-verifies the current session's own password via
// authApi.verifyPassword (see server/src/modules/auth/auth.service.js's verifyPassword) before
// letting a caller proceed with something sensitive. onConfirm receives the typed password and
// should throw on failure (e.g. let the axios rejection propagate); this modal shows the error
// inline and keeps itself open rather than closing on failure.
export default function ConfirmPasswordModal({ isOpen, title, message, confirmLabel = "Confirm", onConfirm, onCancel }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isVerifying) return;
    setPassword("");
    setError("");
    onCancel();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || isVerifying) return;
    setIsVerifying(true);
    setError("");
    try {
      await onConfirm(password);
      setPassword("");
    } catch (err) {
      setError(err?.response?.data?.message || "Incorrect password");
    } finally {
      setIsVerifying(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center",
        justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#ffffff", borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          padding: "28px 28px 24px", maxWidth: "380px", width: "calc(100% - 32px)", fontFamily: "Inter, sans-serif",
        }}
      >
        <h2 style={{ margin: "0 0 10px 0", fontSize: "17px", fontWeight: "700", color: "#111827" }}>{title}</h2>
        <p style={{ margin: "0 0 18px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.55" }}>{message}</p>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          placeholder="Password"
          style={{
            width: "100%", padding: "11px 14px", fontSize: "14px", fontFamily: "Inter, sans-serif",
            border: error ? "1.5px solid #DC2626" : "1.5px solid #E5E7EB", borderRadius: "10px",
            outline: "none", boxSizing: "border-box", marginBottom: error ? "6px" : "22px",
          }}
        />
        {error && <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "#DC2626", fontWeight: 600 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isVerifying}
            style={{
              padding: "9px 18px", backgroundColor: "#F3F4F6", color: "#374151", border: "none",
              borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif",
              cursor: isVerifying ? "default" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isVerifying || !password}
            style={{
              padding: "9px 20px", backgroundColor: "#25476a", color: "#ffffff", border: "none",
              borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif",
              cursor: isVerifying || !password ? "default" : "pointer", opacity: isVerifying || !password ? 0.7 : 1,
            }}
          >
            {isVerifying ? "Checking…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
