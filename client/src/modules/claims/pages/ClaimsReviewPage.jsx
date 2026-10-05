import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiChevronRight, FiInbox, FiSearch, FiSliders, FiUsers } from "react-icons/fi";
import { usePermissions } from "../../../hooks/usePermissions";
import { useWorkspaceClaims } from "../hooks/useClaims";
import { ClaimStatusPill, T, TYPE_LABEL, cardStyle, formatDate, formatMoney } from "../shared";
import ClaimReviewDialog from "../components/ClaimReviewDialog";
import ClaimRatesDialog from "../components/ClaimRatesDialog";
import SupervisorsDialog from "../components/SupervisorsDialog";

// Educator claims, for the workspace: the admin app's Billing → "Educator Claims" tab
// (`embedded`: Billing supplies the heading; see BillingPage.jsx). An educator's claim is approved
// or declined by their supervisor and then paid by the admin; an educator with no supervisor has
// their claim approved by the admin instead. What a staff member can act on depends on their role
// (access.registry.js); the owner can do everything, including deciding for a supervisor.
//
// A supervisor's own view of their claims is a different page: SupervisorHomePage.jsx.

const STAGES = [
  { key: "pending_supervisor", label: "With supervisor", empty: "No claims are waiting on a supervisor." },
  { key: "pending_admin", label: "Needs your approval", empty: "No claims are waiting for the admin's approval. Only claims from educators with no supervisor come here." },
  { key: "approved", label: "To pay", empty: "Nothing is approved and waiting to be paid." },
  { key: "paid", label: "Paid", empty: "No claims have been paid yet." },
  { key: "rejected", label: "Declined", empty: "No claims have been declined." },
];
export default function ClaimsReviewPage({ embedded = false }) {
  const { can } = usePermissions();
  const canSupervise = can("claims", "edit");
  const canApprove = can("claims-approval", "edit");
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, error } = useWorkspaceClaims();
  const [picked, setStage] = useState(null);
  const [search, setSearch] = useState("");
  const [showRates, setShowRates] = useState(false);
  const [showSupervisors, setShowSupervisors] = useState(false);

  const claims = useMemo(() => data?.claims || [], [data]);
  const counts = data?.counts || {};
  const amounts = data?.amounts || {};
  // Opened from a notification with ?claim=<id>.
  const openId = searchParams.get("claim");
  // Only ?claim= is touched — the rest of the URL (Billing's ?tab=) stays as it is.
  const open = (id) => setSearchParams((prev) => { const next = new URLSearchParams(prev); if (id) next.set("claim", id); else next.delete("claim"); return next; }, { replace: true });

  // Until the viewer picks a stage, show the first one that has something for them to do.
  const mine = [canApprove && "pending_admin", canApprove && "approved", canSupervise && "pending_supervisor"].filter(Boolean);
  const stage = picked || mine.find((key) => counts[key] > 0) || STAGES.find((s) => counts[s.key] > 0)?.key || "pending_supervisor";

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return claims
      .filter((c) => c.status === stage)
      .filter((c) => !term || [c.teacherName, c.courseName, c.className, c.hubName, c.claimNumber].some((text) => text?.toLowerCase().includes(term)));
  }, [claims, stage, search]);
  const headerButton = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", color: T.accent, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" };

  const current = STAGES.find((s) => s.key === stage) || STAGES[0];
  const currency = claims[0]?.currency || "KES";

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          {!embedded && <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.ink, letterSpacing: "-0.5px" }}>Educator Claims</h1>}
          <p style={{ margin: embedded ? 0 : "4px 0 0", fontSize: 13.5, color: T.inkMuted }}>
            Payment requests from educators — approved by their supervisor, then paid by the admin. With no supervisor, the admin approves.
          </p>
        </div>
        {canApprove && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setShowSupervisors(true)} style={headerButton}><FiUsers size={15} /> Supervisors</button>
            <button type="button" onClick={() => setShowRates(true)} style={headerButton}><FiSliders size={15} /> Session rates</button>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {STAGES.map((s) => {
          const active = s.key === stage;
          return (
            <button key={s.key} type="button" onClick={() => setStage(s.key)} aria-pressed={active} style={{ ...cardStyle, padding: "14px 16px", textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif", border: `2px solid ${active ? T.accent : "#EEF1F5"}`, background: active ? "#F3F8FC" : "#fff" }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: active ? T.accent : T.inkMuted }}>{s.label}</p>
              <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 900, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{counts[s.key] || 0}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkFaint, fontVariantNumeric: "tabular-nums" }}>{formatMoney(amounts[s.key] || 0, currency)}</p>
            </button>
          );
        })}
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>{current.label}</p>
          <div style={{ position: "relative", flex: "0 1 280px" }}>
            <FiSearch size={15} color={T.inkFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search educator, course or claim no." aria-label="Search claims" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }} />
          </div>
        </div>

        {isLoading ? (
          <p style={{ margin: 0, padding: "44px 20px", textAlign: "center", fontSize: 14, color: T.inkMuted }}>Loading claims…</p>
        ) : isError ? (
          <p style={{ margin: 0, padding: "44px 20px", textAlign: "center", fontSize: 14, color: "#B91C1C" }}>{error?.message || "Claims couldn't be loaded"}</p>
        ) : visible.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <FiInbox size={28} color="#B8C8D5" />
            <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 700, color: T.ink }}>{search ? "No claims match your search" : current.empty}</p>
          </div>
        ) : (
          <div>
            {visible.map((claim, index) => (
              <button key={claim.id} type="button" onClick={() => open(claim.id)} className="claim-row" style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 18px", textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif", background: "#fff", border: "none", borderTop: index ? `1px solid #F1F5F9` : "none", flexWrap: "wrap" }}>
                <div style={{ flex: "2 1 220px", minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{claim.teacherName}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[claim.courseName, claim.className, claim.hubName].filter(Boolean).join(" · ")}</p>
                </div>
                <div style={{ flex: "1 1 130px", minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink }}>{TYPE_LABEL[claim.type]}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkFaint }}>{claim.sessionsDelivered}/{claim.sessionsTotal} sessions · {formatDate(claim.createdAt)}</p>
                </div>
                <ClaimStatusPill status={claim.status} size="small" />
                <p style={{ margin: 0, minWidth: 110, textAlign: "right", fontSize: 15, fontWeight: 800, color: T.accent, fontVariantNumeric: "tabular-nums" }}>{formatMoney(claim.amount, claim.currency)}</p>
                <FiChevronRight size={16} color={T.inkFaint} />
              </button>
            ))}
          </div>
        )}
      </div>

      {openId && <ClaimReviewDialog claimId={openId} canSupervise={canSupervise} canApprove={canApprove} onClose={() => open(null)} />}
      {showRates && <ClaimRatesDialog onClose={() => setShowRates(false)} />}
      {showSupervisors && <SupervisorsDialog onClose={() => setShowSupervisors(false)} />}

      <style>{`
        .claim-row:hover { background: #F8FBFE !important; }
        .claim-row:focus-visible { outline: 2px solid ${T.accentLight}; outline-offset: -2px; }
      `}</style>
    </div>
  );
}
