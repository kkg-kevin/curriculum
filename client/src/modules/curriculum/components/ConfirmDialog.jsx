import { useEffect } from "react";

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              backgroundColor: isDanger ? "#FFF5F5" : "#EFF6FF",
              border: `1px solid ${isDanger ? "#FECACA" : "#BFDBFE"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              flexShrink: 0,
            }}
          >
            {isDanger ? "🗑" : "⚠"}
          </div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#111827" }}>
            {title}
          </h3>
        </div>

        <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.55", paddingLeft: "50px" }}>
          {message}
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "9px 18px",
              backgroundColor: "transparent",
              color: "#374151",
              border: "1.5px solid #E5E7EB",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "9px 18px",
              backgroundColor: isDanger ? "#EF4444" : "#0D47A1",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
