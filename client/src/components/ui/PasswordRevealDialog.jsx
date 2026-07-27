import { useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

// Shown once, right after an admin sets or resets someone's portal password — passwords are
// bcrypt-hashed at rest (see server/src/modules/auth/user.model.js), so this is the only moment
// it's ever visible again. Copy it now; revisiting the edit form later always shows a blank
// field, since there's no plaintext to pre-fill it with.
export default function PasswordRevealDialog({ isOpen, password, subjectName, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Password copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          padding: "28px 28px 24px",
          maxWidth: "420px",
          width: "calc(100% - 32px)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <h2 style={{ margin: "0 0 10px 0", fontSize: "17px", fontWeight: "700", color: "#111827" }}>
          Password set
        </h2>
        <p style={{ margin: "0 0 18px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.55" }}>
          {subjectName ? `Share this with ${subjectName} now` : "Copy this now"} — for security it
          won't be shown again. Coming back to this form later will always show a blank password field.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            backgroundColor: "#F9FAFB",
            border: "1.5px solid #E5E7EB",
            borderRadius: "10px",
            marginBottom: "22px",
          }}
        >
          <code style={{ flex: 1, fontSize: "15px", fontWeight: "600", color: "#111827", letterSpacing: "0.02em", wordBreak: "break-all" }}>
            {password}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              flexShrink: 0,
              padding: "7px 14px",
              backgroundColor: copied ? "#e8f5fb" : "#25476a",
              color: copied ? "#25476a" : "#fff",
              border: copied ? "1.5px solid #a8d5ee" : "none",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: "700",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 20px",
              backgroundColor: "#25476a",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
