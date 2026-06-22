import { useState } from "react";
import { createPortal } from "react-dom";

const inputStyle = (hasError) => ({
  width: "100%",
  padding: "10px 13px",
  borderRadius: "9px",
  border: `1.5px solid ${hasError ? "#EF4444" : "#E5E7EB"}`,
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: hasError ? "#FFF5F5" : "#F9FAFB",
  color: "#111827",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
});

export default function CreateVersionModal({ isOpen, onClose, onSubmit, isPending }) {
  const [label, setLabel]   = useState("");
  const [notes, setNotes]   = useState("");
  const [touched, setTouched] = useState(false);

  if (!isOpen) return null;

  const labelError = touched && !label.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!label.trim()) return;
    onSubmit({ versionLabel: label.trim(), changeNotes: notes.trim() });
  };

  const handleClose = () => {
    setLabel("");
    setNotes("");
    setTouched(false);
    onClose();
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
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          width: "calc(100% - 32px)",
          maxWidth: "460px",
          fontFamily: "Inter, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #F3F4F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                backgroundColor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                flexShrink: 0,
              }}
            >
              📌
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#111827" }}>
                Save as New Version
              </h2>
              <p style={{ margin: "1px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
                Snapshots the current curriculum state as a draft
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#F3F4F6",
              color: "#6B7280",
              fontSize: "16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Version label */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Version Label <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => setTouched(true)}
                style={inputStyle(labelError)}
                placeholder="e.g. 2025 Update, Post-Review Draft"
                autoFocus
              />
              {labelError && (
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#EF4444" }}>
                  Version label is required
                </p>
              )}
            </div>

            {/* Change notes */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <label
                  style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}
                >
                  Change Notes
                </label>
                <span style={{ fontSize: "11px", color: "#9CA3AF" }}>optional</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{
                  ...inputStyle(false),
                  resize: "vertical",
                  minHeight: "72px",
                  lineHeight: "1.5",
                }}
                placeholder="Briefly describe what changed in this version…"
              />
            </div>

            {/* Info banner */}
            <div
              style={{
                padding: "10px 13px",
                backgroundColor: "#F0F9FF",
                border: "1px solid #BAE6FD",
                borderRadius: "9px",
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>ℹ️</span>
              <p style={{ margin: 0, fontSize: "12px", color: "#0369A1", lineHeight: "1.5" }}>
                The new version will be saved as a <strong>draft</strong>. You can review it
                and publish it when ready — publishing will archive the current active version.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "14px 24px 18px",
              borderTop: "1px solid #F3F4F6",
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              style={{
                padding: "9px 18px",
                backgroundColor: "transparent",
                color: "#374151",
                border: "1.5px solid #E5E7EB",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "600",
                fontFamily: "Inter, sans-serif",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: "9px 20px",
                backgroundColor: isPending ? "#93C5FD" : "#0D47A1",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "600",
                fontFamily: "Inter, sans-serif",
                cursor: isPending ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "7px",
                transition: "background-color 0.15s",
              }}
            >
              {isPending ? (
                <>
                  <span
                    style={{
                      width: "13px",
                      height: "13px",
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#ffffff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Saving…
                </>
              ) : (
                "Save Draft"
              )}
            </button>
          </div>
        </form>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>,
    document.body
  );
}
