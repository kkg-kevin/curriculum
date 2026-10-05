import { FiAlertTriangle, FiFileText } from "react-icons/fi";
import { ClaimStatusPill, ClaimTimeline, T, TYPE_LABEL, formatDate, formatMoney, invoiceHref } from "../shared";

// One claim, as it reads to anyone following it: what was asked for, how far it has got, the
// invoice, and — if it was declined — why. `actions` is whatever the viewer can do with it.
export default function ClaimCard({ claim, actions = null }) {
  const href = invoiceHref(claim);
  return (
    <div style={{ padding: 16, borderRadius: 14, background: "#fff", border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint, fontWeight: 600 }}>{claim.claimNumber} · {formatDate(claim.createdAt)}</p>
          <p style={{ margin: "3px 0 0", fontSize: 14.5, fontWeight: 800, color: T.ink }}>
            {TYPE_LABEL[claim.type]} <span style={{ color: T.accent, fontVariantNumeric: "tabular-nums" }}>· {formatMoney(claim.amount, claim.currency)}</span>
          </p>
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
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.accentMid, textDecoration: "none" }}>
            <FiFileText size={14} /> {claim.invoiceFilename || "View invoice"}
          </a>
        ) : <span />}
        {actions}
      </div>
    </div>
  );
}
