import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiDownload, FiExternalLink, FiX } from "react-icons/fi";
import { claimInvoiceFile } from "../invoicePdf";
import { T, ghostButton, invoiceHref, primaryButton } from "../shared";

// The claim's invoice PDF, built in the browser from its own figures (invoicePdf.js), as a
// temporary address the page can show — rebuilt whenever `claim` changes.
function useInvoiceFile(claim) {
  const [file, setFile] = useState(null); // { url, filename }
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    setFailed(false);
    claimInvoiceFile(claim)
      .then(({ blob, filename }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setFile({ url, filename });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [claim]);

  return { file, failed };
}

// The educator's uploaded eTIMS invoice, fetched into the page — the API won't let its files be
// framed by another site, but a copy held by the page itself can be shown and saved.
function useEtimsFile(claim, enabled = true) {
  const [file, setFile] = useState(null);
  const [failed, setFailed] = useState(false);
  const href = invoiceHref(claim);

  useEffect(() => {
    if (!enabled || !href) return undefined;
    let url = null;
    let cancelled = false;
    setFile(null);
    setFailed(false);
    fetch(href)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: "application/pdf" }));
        setFile({ url, filename: claim.invoiceFilename || `${claim.claimNumber || "claim"}-etims.pdf` });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [href, enabled, claim.invoiceFilename, claim.claimNumber]);

  return { file, failed, href };
}

function saveFile(file) {
  const a = document.createElement("a");
  a.href = file.url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function InvoiceFrame({ file, failed, title, fit = false }) {
  if (failed) return <p style={{ margin: 0, padding: 40, textAlign: "center", fontSize: 14, color: "#B91C1C" }}>The invoice couldn&apos;t be built. Try again in a moment.</p>;
  if (!file) return <p style={{ margin: 0, padding: 40, textAlign: "center", fontSize: 14, color: T.inkMuted }}>Preparing the invoice…</p>;
  // `fit`: the page at full width, without the thumbnails strip — for the small preview.
  return <iframe title={title} src={fit ? `${file.url}#navpanes=0&view=FitH` : file.url} style={{ width: "100%", height: "100%", border: 0, display: "block" }} />;
}

// The same invoice shown inside the page it's opened from (the request-payment pop-up), not in a
// window of its own — it follows the figures as they change.
export function ClaimInvoicePreview({ claim, height = 460 }) {
  const { file, failed } = useInvoiceFile(claim);
  const title = `Claim invoice ${claim.claimNumber || "(draft)"}`;
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${T.border}` }}>
        <a href={file?.url} target="_blank" rel="noreferrer" aria-disabled={!file} onClick={(e) => !file && e.preventDefault()} style={{ ...ghostButton, padding: "6px 10px", fontSize: 12.5, textDecoration: "none", opacity: file ? 1 : 0.5 }}>
          <FiExternalLink size={13} /> Open in new tab
        </a>
        <button type="button" onClick={() => saveFile(file)} disabled={!file} style={{ ...ghostButton, padding: "6px 10px", fontSize: 12.5, opacity: file ? 1 : 0.5 }}>
          <FiDownload size={13} /> Download
        </button>
      </div>
      <div style={{ height, background: "#E5E7EB" }}>
        <InvoiceFrame file={file} failed={failed} title={title} fit />
      </div>
    </div>
  );
}

// One claim's invoices shown beside a list (My Invoices): the claim invoice or the eTIMS invoice,
// a switch between the two, Open in new tab and Download. `kind` is "claim" or "etims".
export function InvoicePanel({ claim, kind, onKind, onClose }) {
  const generated = useInvoiceFile(claim);
  const etims = useEtimsFile(claim, kind === "etims");
  const showing = kind === "etims" ? etims : generated;
  const { file } = showing;
  const failedText = kind === "etims" ? "The eTIMS invoice couldn't be loaded." : null;
  const title = kind === "etims" ? "eTIMS invoice" : `Claim invoice ${claim.claimNumber || ""}`.trim();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tab = (key, label) => {
    const active = kind === key;
    return (
      <button key={key} type="button" role="tab" aria-selected={active} onClick={() => onKind(key)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 700, background: active ? "#fff" : "transparent", color: active ? T.ink : T.inkMuted, boxShadow: active ? "0 1px 3px rgba(15,23,42,0.12)" : "none" }}>
        {label}
      </button>
    );
  };

  return (
    <section aria-label={title} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{claim.courseName}</p>
          <p style={{ margin: "1px 0 0", fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[claim.claimNumber, claim.className, claim.hubName].filter(Boolean).join(" · ")}</p>
        </div>
        {claim.invoiceUrl && (
          <div role="tablist" aria-label="Which invoice" style={{ display: "flex", padding: 3, borderRadius: 10, background: "#EEF2F7" }}>
            {tab("claim", "Claim invoice")}
            {tab("etims", "eTIMS invoice")}
          </div>
        )}
        <a href={file?.url || (kind === "etims" ? etims.href : undefined)} target="_blank" rel="noreferrer" aria-disabled={!file && kind !== "etims"} onClick={(e) => !file && kind !== "etims" && e.preventDefault()} style={{ ...ghostButton, padding: "7px 11px", fontSize: 12.5, textDecoration: "none" }}>
          <FiExternalLink size={13} /> Open in new tab
        </a>
        <button type="button" onClick={() => saveFile(file)} disabled={!file} style={{ ...primaryButton(!file), padding: "8px 13px", fontSize: 12.5 }}>
          <FiDownload size={13} /> Download
        </button>
        <button type="button" onClick={onClose} aria-label="Close invoice" style={{ ...ghostButton, padding: "7px 9px" }}>
          <FiX size={15} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, background: "#E5E7EB" }}>
        {showing.failed && failedText ? (
          <p style={{ margin: 0, padding: 40, textAlign: "center", fontSize: 14, color: "#B91C1C" }}>{failedText} Try Open in new tab.</p>
        ) : (
          <InvoiceFrame file={file} failed={showing.failed} title={title} fit />
        )}
      </div>
    </section>
  );
}

// A claim's generated invoice, opened on screen: the PDF in a frame, with Download and Open in a
// new tab. Phones that won't show a PDF inside a page still get the two buttons.
export default function ClaimInvoiceViewer({ claim, onClose }) {
  const { file, failed } = useInvoiceFile(claim);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = `Claim invoice ${claim.claimNumber || "(draft)"}`;

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "3vh 12px", fontFamily: "Inter, sans-serif" }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 860, height: "94vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(15,23,42,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[claim.courseName, claim.className].filter(Boolean).join(" · ")}</p>
          </div>
          <a href={file?.url} target="_blank" rel="noreferrer" aria-disabled={!file} onClick={(e) => !file && e.preventDefault()} style={{ ...ghostButton, padding: "8px 12px", fontSize: 13, textDecoration: "none", opacity: file ? 1 : 0.5 }}>
            <FiExternalLink size={14} /> Open in new tab
          </a>
          <button type="button" onClick={() => saveFile(file)} disabled={!file} style={{ ...primaryButton(!file), padding: "9px 14px", fontSize: 13 }}>
            <FiDownload size={14} /> Download
          </button>
          <button type="button" onClick={onClose} aria-label="Close invoice" style={{ ...ghostButton, padding: "8px 10px" }}>
            <FiX size={16} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: "#E5E7EB" }}>
          <InvoiceFrame file={file} failed={failed} title={title} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
