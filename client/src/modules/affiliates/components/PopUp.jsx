import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { BRAND, FONT } from "../../../theme/brand";

// A pop-up for the affiliates screens (adding a prospect, uploading a list — 24 Nov 2026): a box in
// the middle on a computer, a sheet from the bottom on a phone. Escape or a click outside closes it,
// and the page behind doesn't scroll while it's open.
// (Positioned with top/left + size, never "inset: 0" — the portal's phone styles in global.css
// re-align anything fixed with inset 0 as one of their own dialogs.)
export default function PopUp({ title, subtitle, onClose, children, width = 640 }) {
  const [phone, setPhone] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 640 : false));
  useEffect(() => {
    const onResize = () => setPhone(window.innerWidth < 640);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  return createPortal(
    <div role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 10000, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: phone ? "flex-end" : "center", justifyContent: "center", padding: phone ? 0 : 16, boxSizing: "border-box" }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{ background: "#fff", width: "100%", maxWidth: phone ? "100%" : width, maxHeight: phone ? "92dvh" : "90vh", borderRadius: phone ? "20px 20px 0 0" : 18, display: "flex", flexDirection: "column", fontFamily: FONT, boxShadow: "0 24px 60px rgba(15,23,42,0.28)", boxSizing: "border-box", paddingBottom: phone ? "env(safe-area-inset-bottom)" : 0 }}>
        {phone && <span aria-hidden style={{ width: 40, height: 4, borderRadius: 4, background: BRAND.border, margin: "8px auto 0", flexShrink: 0 }} />}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: phone ? "10px 12px 12px 18px" : "18px 14px 14px 22px", borderBottom: `1px solid ${BRAND.line}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: BRAND.ink }}>{title}</h2>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 10, border: "none", background: "transparent", color: BRAND.muted, cursor: "pointer" }}><FiX size={20} /></button>
        </div>
        <div style={{ padding: phone ? 18 : 22, overflowY: "auto", overscrollBehavior: "contain" }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
