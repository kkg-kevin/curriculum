import { useEffect } from "react";
import { FiX } from "react-icons/fi";
import CertificateViewer from "./CertificateViewer";
import { useCertificate } from "../hooks/useCertificates";
import { certificateFields, formatCertificateDate, KIND_LABELS } from "../utils/certificate";

const INK = "#111827";
const INK_MUTED = "#6B7280";
const BORDER = "#E5E7EB";

/**
 * Staff: a certificate they issued, over the page (20 Nov 2026 — the Reports card's "View").
 * Loads the full record by id (GET /api/certificates/:id — an educator only for a class they
 * teach), so the sheet shows the signatory and QR exactly as the family sees it, with Download PDF
 * and the verification link. A revoked one is shown with its reason above it.
 */
export default function CertificatePreviewDialog({ certificateId, onClose }) {
  const { data: certificate, isLoading, isError } = useCertificate(certificateId);
  const c = certificate ? certificateFields(certificate) : null;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Certificate"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1300, backgroundColor: "rgba(17,24,39,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 980, maxHeight: "100%", overflowY: "auto", backgroundColor: "#fff", borderRadius: 18, padding: "18px 20px 22px", fontFamily: "Inter, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: INK }}>
              {c ? `${c.learnerName} · ${KIND_LABELS[c.kind] || "Course"} certificate` : "Certificate"}
            </h2>
            {c && (
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: INK_MUTED }}>
                {c.partOf ? `${c.partOf} · ${c.title}` : c.title} · Awarded {formatCertificateDate(c.issuedAt)} · {c.number}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, border: `1.5px solid ${BORDER}`, background: "#fff", color: INK_MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FiX size={17} />
          </button>
        </div>

        {isLoading && <p style={{ margin: "40px 0", textAlign: "center", fontSize: 13, color: INK_MUTED }}>Loading the certificate…</p>}
        {isError && <p style={{ margin: "40px 0", textAlign: "center", fontSize: 13, color: "#B91C1C" }}>Couldn't load this certificate.</p>}
        {c?.status === "revoked" && (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, backgroundColor: "#FEF2F2", border: "1px solid #FECACA", fontSize: 12.5, color: "#991B1B", fontWeight: 600 }}>
            Revoked{c.revokeReason ? ` — ${c.revokeReason}` : ""}. Its verification link says it is no longer valid.
          </div>
        )}
        {certificate && <CertificateViewer certificate={certificate} actions={c?.status === "issued"} />}
        {certificate && c?.status === "issued" && (
          <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 11.5, color: INK_MUTED }}>
            This is the certificate the learner and their family see in their portal.
          </p>
        )}
      </div>
    </div>
  );
}
