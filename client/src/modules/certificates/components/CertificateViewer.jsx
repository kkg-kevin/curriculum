import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiDownload, FiLink, FiCheck } from "react-icons/fi";
import CertificateDocument, { CERT_WIDTH, CERT_HEIGHT } from "./CertificateDocument";
import { downloadElementAsPdf } from "../../../utils/pdf";
import { certificateFields, certificateFilename, verifyUrl } from "../utils/certificate";

const ACCENT = "#25476a";
const BORDER = "#E5E7EB";

// The full-size copy the PDF is captured from. Kept far off-screen rather than display:none
// (html2canvas can't capture a hidden node) — the same approach as the report's print document.
const PRINT_ID = "certificate-print-doc";
const offscreenStyle = { position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" };

function actionBtn(primary, disabled) {
  return {
    display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10,
    border: `1.5px solid ${primary ? ACCENT : BORDER}`, background: primary ? ACCENT : "#fff",
    color: primary ? "#fff" : ACCENT, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}

/**
 * A certificate on screen: the sheet scaled to whatever width it's given, with Download PDF and
 * Copy verification link under it. Used by the learner's own certificate page and by the public
 * verification page. `actions={false}` shows the sheet alone.
 */
export default function CertificateViewer({ certificate, actions = true }) {
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { verifyToken } = certificateFields(certificate);
  const url = verifyUrl(verifyToken);

  // The sheet is a fixed 1123×794; fit it to the frame's width and keep it sharp at any size.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / CERT_WIDTH));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadElementAsPdf(PRINT_ID, certificateFilename(certificate), { backgroundColor: "#FFFDF8", orientation: "landscape" });
    } catch {
      toast.error("Couldn't create the PDF — try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div ref={frameRef} style={{ width: "100%", maxWidth: CERT_WIDTH, margin: "0 auto" }}>
        <div style={{ height: CERT_HEIGHT * scale, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 30px rgba(17,24,39,0.12)", border: `1px solid ${BORDER}` }}>
          <div style={{ width: CERT_WIDTH, height: CERT_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <CertificateDocument certificate={certificate} />
          </div>
        </div>
      </div>

      {actions && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          <button type="button" onClick={handleDownload} disabled={downloading} style={actionBtn(true, downloading)}>
            <FiDownload size={15} />
            {downloading ? "Preparing…" : "Download PDF"}
          </button>
          {url && (
            <button type="button" onClick={handleCopy} style={actionBtn(false, false)}>
              {copied ? <FiCheck size={15} /> : <FiLink size={15} />}
              {copied ? "Link copied" : "Copy verification link"}
            </button>
          )}
        </div>
      )}

      {actions && (
        <div style={offscreenStyle} aria-hidden="true">
          <CertificateDocument certificate={certificate} id={PRINT_ID} />
        </div>
      )}
    </div>
  );
}
