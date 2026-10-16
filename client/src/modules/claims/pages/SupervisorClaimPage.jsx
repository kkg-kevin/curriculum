import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { usePermissions } from "../../../hooks/usePermissions";
import { ClaimReview } from "../components/ClaimReviewDialog";
import { T } from "../shared";

// One claim, as a page of its own: what's asked for and how it was worked out, both invoices
// (opening beside it), the course's records, and the decision. Back — and after a decision —
// returns to wherever the claim was opened from; opened straight from a link, to `fallback`.
function ClaimPage({ canSupervise, canApprove, fallback, backLabel }) {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const back = () => (location.key !== "default" ? navigate(-1) : navigate(fallback));

  return (
    <ClaimReview
      claimId={claimId}
      canSupervise={canSupervise}
      canApprove={canApprove}
      onDone={back}
      asPage
      frame={({ title, subtitle, children }) => (
        <div style={{ fontFamily: "Inter, sans-serif" }}>
          <button type="button" onClick={back} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, marginBottom: 12, border: "none", background: "none", color: T.inkMuted, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            <FiArrowLeft size={14} /> {backLabel}
          </button>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: T.ink, letterSpacing: "-0.4px" }}>{title}</h1>
          {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13.5, color: T.inkMuted }}>{subtitle}</p>}
          <div style={{ marginTop: 18 }}>{children}</div>
        </div>
      )}
    />
  );
}

// The supervisor's: /supervisor-portal/claims/:claimId.
export default function SupervisorClaimPage() {
  return <ClaimPage canSupervise canApprove={false} fallback="/supervisor-portal/claims" backLabel="Claims" />;
}

// The workspace's, from Billing → Educator Claims: /billing/claims/:claimId. What the viewer can
// decide is their role's (the owner can do everything, including deciding for a supervisor).
export function AdminClaimPage() {
  const { can } = usePermissions();
  return <ClaimPage canSupervise={can("claims", "edit")} canApprove={can("claims-approval", "edit")} fallback="/billing?tab=claims" backLabel="Educator Claims" />;
}
