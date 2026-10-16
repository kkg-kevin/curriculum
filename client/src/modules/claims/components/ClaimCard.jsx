import { useState } from "react";
import { FiAlertTriangle, FiEye, FiFileText } from "react-icons/fi";
import { ClaimStatusPill, ClaimTimeline, T, TYPE_LABEL, claimBasis, formatDate, formatMoney, invoiceHref } from "../shared";
import ClaimInvoiceViewer from "./ClaimInvoiceViewer";

const linkStyle = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.accentMid, textDecoration: "none", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "Inter, sans-serif" };

// The claim's two invoices: the one the system generated from its figures (opens on screen, with
// a download), and the educator's uploaded eTIMS invoice (opens in a new tab). With `onView`
// they open nothing themselves: the page shows the one picked (My Invoices' side panel), and
// `active` marks which is showing.
export function ClaimInvoiceLinks({ claim, onView, active = null }) {
  const [viewing, setViewing] = useState(false);
  const href = invoiceHref(claim);
  if (onView) {
    const pick = (kind) => ({ ...linkStyle, padding: "6px 10px", borderRadius: 8, background: active === kind ? T.tintBg : "none", color: active === kind ? T.accent : T.accentMid });
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <button type="button" onClick={() => onView("claim")} aria-pressed={active === "claim"} style={pick("claim")}>
          <FiEye size={14} /> Claim invoice
        </button>
        {href && (
          <button type="button" onClick={() => onView("etims")} aria-pressed={active === "etims"} style={pick("etims")} title={claim.invoiceFilename || undefined}>
            <FiFileText size={14} /> eTIMS invoice
          </button>
        )}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <button type="button" onClick={() => setViewing(true)} style={linkStyle}>
        <FiEye size={14} /> Claim invoice
      </button>
      {viewing && <ClaimInvoiceViewer claim={claim} onClose={() => setViewing(false)} />}
      {href && (
        <a href={href} target="_blank" rel="noreferrer" style={linkStyle} title={claim.invoiceFilename || undefined}>
          <FiFileText size={14} /> eTIMS invoice
        </a>
      )}
    </span>
  );
}

// One claim, as it reads to anyone following it: what was asked for and how it was worked out,
// how far it has got, its invoices, and — if it was declined — why. `actions` is whatever the
// viewer can do with it.
export default function ClaimCard({ claim, actions = null }) {
  return (
    <div style={{ padding: 16, borderRadius: 14, background: "#fff", border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint, fontWeight: 600 }}>{claim.claimNumber} · {formatDate(claim.createdAt)}</p>
          <p style={{ margin: "3px 0 0", fontSize: 14.5, fontWeight: 800, color: T.ink }}>
            {TYPE_LABEL[claim.type]} <span style={{ color: T.accent, fontVariantNumeric: "tabular-nums" }}>· {formatMoney(claim.amount, claim.currency)}</span>
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{claimBasis(claim)}</p>
        </div>
        <ClaimStatusPill status={claim.status} size="small" />
      </div>

      <div style={{ margin: "16px 0 4px" }}><ClaimTimeline claim={claim} /></div>

      {claim.status === "rejected" && (
        <div style={{ display: "flex", gap: 10, marginTop: 14, padding: "11px 13px", borderRadius: 11, background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <FiAlertTriangle size={16} color="#B91C1C" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#991B1B" }}>
              Declined by {claim.rejectedStage === "admin" ? claim.adminName || "the admin" : claim.supervisorName || "the supervisor"}
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#7F1D1D", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{claim.rejectionReason}</p>
          </div>
        </div>
      )}

      {claim.status === "paid" && claim.paymentReference && (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: T.inkMuted }}>Payment reference: <strong style={{ color: T.ink }}>{claim.paymentReference}</strong></p>
      )}

      {claim.note && <p style={{ margin: "12px 0 0", fontSize: 12.5, color: T.inkMuted, lineHeight: 1.5, overflowWrap: "anywhere" }}><strong style={{ color: T.ink }}>Note:</strong> {claim.note}</p>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <ClaimInvoiceLinks claim={claim} />
        {actions}
      </div>
    </div>
  );
}
