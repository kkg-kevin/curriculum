import { useState } from "react";
import { useHubVisitsQuery, useHubRevenueSummaryQuery, useDeleteVisit } from "../hooks/useHubVisits";
import LogVisitModal from "./LogVisitModal";
import GenerateChargesPanel from "./GenerateChargesPanel";

const cardStyle = { padding: "12px 14px", borderRadius: "10px", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee" };
const cardLabel = { margin: "0 0 2px", fontSize: "10.5px", fontWeight: "700", color: "#25476a", textTransform: "uppercase" };
const cardValue = { margin: 0, fontSize: "15px", fontWeight: "800", color: "#25476a" };

function fmt(amount) {
  return `KES ${Number(amount || 0).toLocaleString()}`;
}

const statusColors = {
  unbilled: { bg: "#FFF7ED", border: "#FED7AA", color: "#C2410C" },
  invoiced: { bg: "#F0FDF4", border: "#BBF7D0", color: "#15803D" },
  waived:   { bg: "#F9FAFB", border: "#E5E7EB", color: "#6B7280" },
};

// The non-school hub's own finance surface — revenue summary, its visits log, and the two
// actions (log a visit / generate charges) that drive the whole hub_usage billing flow. See
// hub-visit.service.js's header comment for the design behind why this reuses Billing instead
// of a parallel ledger; charges a learner actually owes surface in their existing Billing views,
// not here.
export default function HubFinanceTab({ hubId, learners, spaces }) {
  const [showLogVisit, setShowLogVisit] = useState(false);
  const [showGenerateCharges, setShowGenerateCharges] = useState(false);
  const { data: summary, isLoading: summaryLoading } = useHubRevenueSummaryQuery(hubId);
  const { data: visitsData, isLoading: visitsLoading } = useHubVisitsQuery({ hubId });
  const { mutate: deleteVisit } = useDeleteVisit();
  const visits = visitsData?.data || [];

  const spaceName = (spaceId) => spaces.find((s) => s.id === spaceId)?.name || "Unknown space";
  const learnerName = (learnerId) => {
    const l = learners.find((x) => x.id === learnerId);
    return l ? `${l.firstName} ${l.lastName}` : "Unknown learner";
  };

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Finance</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setShowGenerateCharges((s) => !s)} style={{ padding: "7px 14px", backgroundColor: "transparent", color: "#25476a", border: "1.5px solid #a8d5ee", borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Generate Charges
          </button>
          <button type="button" onClick={() => setShowLogVisit(true)} style={{ padding: "7px 14px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            + Log a Visit
          </button>
        </div>
      </div>

      <div style={{ padding: "20px" }}>
        {showGenerateCharges && <GenerateChargesPanel hubId={hubId} onClose={() => setShowGenerateCharges(false)} />}

        {summaryLoading ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Loading…</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "18px" }}>
            <div style={cardStyle}>
              <p style={cardLabel}>Invoiced</p>
              <p style={cardValue}>{fmt(summary?.totalInvoiced)}</p>
            </div>
            <div style={{ ...cardStyle, backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <p style={{ ...cardLabel, color: "#15803D" }}>Collected</p>
              <p style={{ ...cardValue, color: "#15803D" }}>{fmt(summary?.totalPaid)}</p>
            </div>
            <div style={{ ...cardStyle, backgroundColor: "#FFF5F5", border: "1px solid #FECACA" }}>
              <p style={{ ...cardLabel, color: "#DC2626" }}>Outstanding</p>
              <p style={{ ...cardValue, color: "#DC2626" }}>{fmt(summary?.totalOutstanding)}</p>
            </div>
            <div style={{ ...cardStyle, backgroundColor: "#FFF7ED", border: "1px solid #FED7AA" }}>
              <p style={{ ...cardLabel, color: "#C2410C" }}>Unbilled ({summary?.unbilledCount ?? 0})</p>
              <p style={{ ...cardValue, color: "#C2410C" }}>{fmt(summary?.unbilledAmount)}</p>
            </div>
          </div>
        )}

        <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Visits Log</p>

        {visitsLoading ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Loading…</p>
        ) : visits.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
            <p style={{ margin: 0, fontSize: "13px" }}>No visits logged yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visits.map((v) => {
              const colors = statusColors[v.billingStatus] || statusColors.unbilled;
              return (
                <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", backgroundColor: "#FAFBFF", border: "1px solid #E5E7EB", borderRadius: 10, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>{learnerName(v.learnerId)}</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>{spaceName(v.spaceId)} · {v.visitDate}{v.hours ? ` · ${v.hours}h` : ""}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.color }}>
                      {v.billingStatus}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{fmt(v.amount)}</span>
                    {v.billingStatus !== "invoiced" && (
                      <button type="button" onClick={() => deleteVisit(v.id)} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 11.5, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showLogVisit && (
        <LogVisitModal hubId={hubId} learners={learners} spaces={spaces} onClose={() => setShowLogVisit(false)} />
      )}
    </div>
  );
}
