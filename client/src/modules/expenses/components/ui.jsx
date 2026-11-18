import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiDownload, FiFile, FiX } from "react-icons/fi";
import { BRAND, FONT, card, pill } from "../../../theme/brand";
import { expensesApi, STATUS } from "../services/expensesApi";

// Shared pieces of the Expenses screens (admin, staff, educator and supervisor portals all use
// them — they take their colours from theme/brand.js, not a portal's own).

export const btn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: `1px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" };
export const primary = { ...btn, background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" };
export const danger = { ...btn, color: BRAND.danger, borderColor: BRAND.dangerBorder };
export const input = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff", minWidth: 0 };
export const label = { display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, minWidth: 0 };
export const hint = { margin: 0, fontSize: 12, color: BRAND.muted, lineHeight: 1.5 };

// Open dialogs, newest last — Escape closes only the top one (a receipt opened over a claim).
const openModals = [];

export function Modal({ title, subtitle, onClose, children, width = 760, footer }) {
  useEffect(() => {
    const token = {};
    openModals.push(token);
    const onKey = (e) => { if (e.key === "Escape" && openModals[openModals.length - 1] === token) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openModals.splice(openModals.indexOf(token), 1);
    };
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div style={{ ...card, width: "100%", maxWidth: width, maxHeight: "94vh", display: "flex", flexDirection: "column", fontFamily: FONT, boxShadow: "0 20px 50px rgba(15,23,42,0.25)", boxSizing: "border-box", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "18px 20px 12px", borderBottom: `1px solid ${BRAND.line}` }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: BRAND.ink, overflowWrap: "anywhere" }}>{title}</h2>
            {subtitle && <div style={{ marginTop: 4, fontSize: 12.5, color: BRAND.muted }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: 6, flexShrink: 0 }}><FiX size={16} /></button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "12px 20px", borderTop: `1px solid ${BRAND.line}`, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", background: BRAND.canvas }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function StatusPill({ status }) {
  const s = STATUS[status] || { label: status, tone: "neutral" };
  return <span style={pill(s.tone)}>{s.label}</span>;
}

// One proof file. The files are private, so each is fetched with the session as a blob — a photo
// shows as a thumbnail, and opens full size; a PDF opens in the viewer; anything else downloads.
export function ProofFile({ file, onRemove, removed = false }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const showable = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(file.mimeType);
  const isImage = file.mimeType?.startsWith("image/") && showable;

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    expensesApi.fileBlob(file.id)
      .then((blob) => { if (!alive) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.id]);

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename || "proof";
    a.click();
  };

  return (
    <div style={{ position: "relative", width: 92, flexShrink: 0, opacity: removed ? 0.55 : 1 }}>
      <button type="button" onClick={() => (showable ? setOpen(true) : download())} disabled={!url} title={file.filename}
        style={{ width: 92, height: 92, borderRadius: 10, border: `1.5px solid ${BRAND.border}`, background: BRAND.canvas, padding: 0, overflow: "hidden", cursor: url ? "pointer" : "wait", display: "grid", placeItems: "center" }}>
        {isImage && url ? <img src={url} alt={file.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ display: "grid", justifyItems: "center", gap: 4, color: BRAND.muted, fontSize: 11, fontWeight: 700, fontFamily: FONT }}><FiFile size={22} />{failed ? "Can't load" : file.mimeType === "application/pdf" ? "PDF" : "File"}</span>}
      </button>
      <div style={{ fontSize: 10.5, color: BRAND.muted, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT }}>{removed ? "Removed · " : ""}{file.filename}</div>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${file.filename}`} style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 999, border: `1px solid ${BRAND.border}`, background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
          <FiX size={12} />
        </button>
      )}
      {open && url && (
        <Modal title={file.filename} onClose={() => setOpen(false)} width={900}
          footer={<button type="button" style={btn} onClick={download}><FiDownload size={14} /> Download</button>}>
          {isImage ? <img src={url} alt={file.filename} style={{ maxWidth: "100%", display: "block", margin: "0 auto", borderRadius: 8 }} />
            : <iframe src={url} title={file.filename} style={{ width: "100%", height: "70vh", border: 0, borderRadius: 8, background: "#fff" }} />}
        </Modal>
      )}
    </div>
  );
}

export function Empty({ children }) {
  return <p style={{ margin: 0, padding: "28px 16px", textAlign: "center", color: BRAND.muted, fontSize: 13.5, fontFamily: FONT }}>{children}</p>;
}
