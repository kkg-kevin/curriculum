import { FiChevronRight, FiPaperclip } from "react-icons/fi";
import { BRAND, FONT, card } from "../../../theme/brand";
import { formatDay, formatMoney } from "../services/expensesApi";
import { Empty, StatusPill } from "./ui";

// A list of claims as rows that wrap on a phone: number and title, who (for reviewers), hub, when,
// amount and status.
export default function ClaimList({ claims, onOpen, showClaimant = false, empty = "No claims here." }) {
  if (!claims.length) return <div style={card}><Empty>{empty}</Empty></div>;
  return (
    <div style={{ ...card, overflow: "hidden" }}>
      {claims.map((c, i) => (
        <button key={c.id} type="button" onClick={() => onOpen(c.id)}
          style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", width: "100%", padding: "13px 16px", border: 0, borderTop: i ? `1px solid ${BRAND.line}` : 0, background: "#fff", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, overflowWrap: "anywhere" }}>
              {c.number && <span style={{ color: BRAND.muted, fontWeight: 700 }}>{c.number} · </span>}{c.title}
            </div>
            <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {showClaimant && <><strong style={{ color: BRAND.inkSoft }}>{c.claimantName}</strong><span>·</span></>}
              {c.hubName && <><span>{c.hubName}</span><span>·</span></>}
              <span>{c.submittedAt ? `Sent ${formatDay(c.submittedAt)}` : `Started ${formatDay(c.createdAt)}`}</span>
              {c.itemCount != null && <><span>·</span><span><FiPaperclip size={11} /> {c.itemCount} {c.itemCount === 1 ? "expense" : "expenses"}</span></>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
            <span style={{ fontSize: 14.5, fontWeight: 900, color: BRAND.ink, whiteSpace: "nowrap" }}>{formatMoney(c.approvedAmount ?? c.totalAmount, c.currency)}</span>
            <StatusPill status={c.status} />
            <FiChevronRight size={16} color={BRAND.faint} />
          </div>
        </button>
      ))}
    </div>
  );
}
