import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import UsageList from "../../../components/ui/UsageList";

// The app's confirm dialog. For a delete, pass `usageCheck` — a function asking the server whether
// the record is still in use (services/api.js's checkDelete). While it asks, Delete waits; when the
// record is in use the dialog says what uses it and Delete is off (the server refuses it anyway),
// and where the record can be switched off instead (`onAlternative`) it offers that — its label
// comes from the server (e.g. "Deactivate the hub instead") unless `alternativeLabel` is given.
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  usageCheck,
  onAlternative,
  alternativeLabel,
}) {
  const [check, setCheck] = useState({ state: "idle", usage: null }); // idle | checking | done

  useEffect(() => {
    if (!isOpen || !usageCheck) { setCheck({ state: "idle", usage: null }); return undefined; }
    let live = true;
    setCheck({ state: "checking", usage: null });
    // A check that fails (no permission, gone already) just leaves the plain confirmation — the
    // server still refuses a delete of anything in use.
    Promise.resolve(usageCheck())
      .then((usage) => { if (live) setCheck({ state: "done", usage }); })
      .catch(() => { if (live) setCheck({ state: "done", usage: null }); });
    return () => { live = false; };
    // Asked once each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const isDanger = variant === "danger";
  const confirmBg = isDanger ? "#EF4444" : "#25476a";
  const confirmHoverBg = isDanger ? "#DC2626" : "#0A3880";
  const checking = check.state === "checking";
  const inUse = !!check.usage?.inUse;
  const alternative = onAlternative && (alternativeLabel || check.usage?.alternative?.label);

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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          padding: "28px 28px 24px",
          maxWidth: inUse ? "480px" : "400px",
          width: "calc(100% - 32px)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <h2
          style={{
            margin: "0 0 10px 0",
            fontSize: "17px",
            fontWeight: "700",
            color: inUse ? "#111827" : isDanger ? "#EF4444" : "#111827",
          }}
        >
          {inUse ? "It's still in use" : title}
        </h2>
        {inUse ? (
          <div style={{ margin: "0 0 20px 0" }}>
            <UsageList usage={check.usage} />
          </div>
        ) : (
          <p
            style={{
              margin: "0 0 24px 0",
              fontSize: "14px",
              color: "#6B7280",
              lineHeight: "1.55",
            }}
          >
            {checking ? "Checking whether it's in use…" : message}
          </p>
        )}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
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
            {inUse ? "Close" : cancelLabel}
          </button>
          {inUse && alternative && (
            <button
              type="button"
              onClick={onAlternative}
              style={{
                padding: "9px 18px",
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
              {alternative}
            </button>
          )}
          {!inUse && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={checking}
              style={{
                padding: "9px 18px",
                backgroundColor: checking ? "#F3A5A5" : confirmBg,
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "600",
                fontFamily: "Inter, sans-serif",
                cursor: checking ? "wait" : "pointer",
              }}
              onMouseEnter={(e) => { if (!checking) e.currentTarget.style.backgroundColor = confirmHoverBg; }}
              onMouseLeave={(e) => { if (!checking) e.currentTarget.style.backgroundColor = confirmBg; }}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
