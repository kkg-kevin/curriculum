import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import UsageList from "./UsageList";

// The safety net for every delete in the app: when the server refuses one because the record is
// still in use (409 IN_USE — services/api.js raises "app:in-use"), this says what uses it. Most
// delete dialogs already warn before anyone confirms (ConfirmDialog's usageCheck); this covers
// the rest, and a record that came into use while the dialog was open. Mounted once, in App.jsx.
export default function InUseNotice() {
  const [notice, setNotice] = useState(null); // { message, usage }

  useEffect(() => {
    const show = (e) => setNotice(e.detail || null);
    window.addEventListener("app:in-use", show);
    return () => window.removeEventListener("app:in-use", show);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setNotice(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notice]);

  if (!notice) return null;
  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setNotice(null); }}
      style={{ position: "fixed", inset: 0, zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="in-use-title" style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", padding: "24px 24px 20px", maxWidth: 460, width: "calc(100% - 32px)", fontFamily: "Inter, sans-serif" }}>
        <h2 id="in-use-title" style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: "#111827" }}>It&apos;s still in use</h2>
        {notice.usage?.usages?.length
          ? <UsageList usage={notice.usage} intro="Nothing was deleted — it's still used by:" />
          : <p style={{ margin: 0, fontSize: 14, color: "#6B7280", lineHeight: 1.55 }}>{notice.message}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" onClick={() => setNotice(null)} style={{ padding: "9px 18px", backgroundColor: "#25476a", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
