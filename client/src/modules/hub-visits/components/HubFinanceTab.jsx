import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EventAvailable as EventAvailableIcon,
  AccountBalance as AccountBalanceIcon,
  Paid as PaidIcon,
  ReceiptLong as ReceiptLongIcon,
  Search as SearchIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from "@mui/icons-material";
import { useAuth } from "../../../context/AuthContext";
import { useHubVisitsQuery, useHubRevenueSummaryQuery, useDeleteVisit } from "../hooks/useHubVisits";
import LogVisitModal from "./LogVisitModal";
import GenerateChargesPanel from "./GenerateChargesPanel";
import { LoadingState, EmptyState } from "../../billing/components/PageStates";
import { inputStyle, formatMoney, rowHoverHandlers } from "../../billing/components/shared";

const VISIT_STATUS_LABELS = { unbilled: "Unbilled", invoiced: "Invoiced", waived: "Waived" };
const VISIT_STATUS_COLORS = {
  unbilled: { bg: "#FFF7ED", color: "#C2410C" },
  invoiced: { bg: "#ECFDF5", color: "#047857" },
  waived: { bg: "#F9FAFB", color: "#6B7280" },
};

function VisitStatusPill({ status }) {
  const style = VISIT_STATUS_COLORS[status] || VISIT_STATUS_COLORS.unbilled;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: style.bg, color: style.color, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
      {VISIT_STATUS_LABELS[status] || status}
    </span>
  );
}

// The stat-tile look (icon square + big number + label) matches BillingPage.jsx's Customers/
// Invoices tabs exactly, so this reads as the same finance product rather than a bolted-on
// side feature.
function StatTile({ icon, label, value, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 11 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: "#F1F7FB", color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 850, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
        <div style={{ fontSize: 11, color: "#6B7280" }}>{label}</div>
      </div>
    </div>
  );
}

// The non-school hub's own finance surface — revenue summary and the visits log. "+ Log a visit"
// is the single entry point; hub-visit.service.js's logVisit bills each visit immediately
// wherever the learner has a resolvable guardian payer, so there's no separate "now go generate
// charges" step for the common case. "Generate charges" stays as a fallback for the visits that
// couldn't be billed automatically (no guardian on file yet, fixed later) — secondary, not a
// parallel primary action. See hub-visit.service.js's header comment for the design behind why
// this reuses Billing instead of a parallel ledger; charges a learner actually owes surface in
// their existing Billing views, not here.
//
// Doubles as BillingPage.jsx's entire view for a non-school hub login (not just an embedded tab
// on the admin's hub view page, its original home) — laid out as a standalone page rather than a
// dense sidebar-fragment for that reason: a first-time hub operator needs the flow to read
// clearly on its own, not assume surrounding page chrome explains it.
//
// `readOnly` is how the admin's own embedded view (LearningHubViewPage.jsx) renders this same
// component — logging visits, generating charges, and deleting a visit are all actions that
// belong to the hub operator running their own space, not the platform admin looking in on it.
// Admin still sees the full revenue summary and visits log, just without any of the controls.
export default function HubFinanceTab({ hubId, learners, spaces, readOnly = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Same base path BillingPage.jsx's own invoice rows link through — admin and a non-school
  // hub's own ("school"-role) login land on different route trees for the same InvoiceDetailPage.
  const billingBasePath = user?.role === "school" ? "/school-portal/billing" : "/billing";
  const [showLogVisit, setShowLogVisit] = useState(false);
  const [showGenerateCharges, setShowGenerateCharges] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: summary, isLoading: summaryLoading } = useHubRevenueSummaryQuery(hubId);
  const { data: visitsData, isLoading: visitsLoading } = useHubVisitsQuery({ hubId });
  const { mutate: deleteVisit } = useDeleteVisit();
  const visits = visitsData?.data || [];
  const hasSpaces = spaces.length > 0;
  const hasUnbilled = (summary?.unbilledCount ?? 0) > 0;

  const spaceName = (spaceId) => spaces.find((s) => s.id === spaceId)?.name || "Unknown space";
  const learnerName = (learnerId) => {
    const l = learners.find((x) => x.id === learnerId);
    return l ? `${l.firstName} ${l.lastName}` : "Unknown learner";
  };

  const filteredVisits = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visits.filter((v) => {
      const matchesStatus = statusFilter === "all" || v.billingStatus === statusFilter;
      const matchesSearch = !query || `${learnerName(v.learnerId)} ${spaceName(v.spaceId)}`.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [visits, search, statusFilter, learners, spaces]);

  return (
    <div>
      {!readOnly && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowLogVisit(true)}
            disabled={!hasSpaces}
            title={hasSpaces ? undefined : "Add a space to this hub first (Settings → Learning Hubs)"}
            style={{ padding: "11px 22px", backgroundColor: hasSpaces ? "#feb139" : "#F3F4F6", color: hasSpaces ? "#17304B" : "#9CA3AF", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, fontFamily: "Inter, sans-serif", cursor: hasSpaces ? "pointer" : "not-allowed" }}
          >
            + Log a visit
          </button>

          {/* Fallback only — the normal flow bills at the moment a visit is logged (see
              hub-visit.service.js's logVisit), so this is just here for visits that couldn't be
              billed automatically (e.g. no guardian on file yet). */}
          {hasUnbilled && (
            <button
              type="button"
              onClick={() => setShowGenerateCharges((s) => !s)}
              style={{ padding: "9px 16px", backgroundColor: "transparent", color: "#C2410C", border: "1.5px solid #FED7AA", borderRadius: 10, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              {showGenerateCharges ? "Hide" : `${formatMoney(summary.unbilledAmount)} still unbilled — generate charges`}
            </button>
          )}
        </div>
      )}

      {!readOnly && showGenerateCharges && (
        <div style={{ marginBottom: 16 }}>
          <GenerateChargesPanel hubId={hubId} onClose={() => setShowGenerateCharges(false)} />
        </div>
      )}

      {summaryLoading ? (
        <LoadingState label="Loading revenue…" inline />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatTile icon={<ReceiptLongIcon fontSize="small" />} label="Invoiced" value={formatMoney(summary?.totalInvoiced)} color="#25476a" />
          <StatTile icon={<PaidIcon fontSize="small" />} label="Collected" value={formatMoney(summary?.totalPaid)} color="#047857" />
          <StatTile icon={<AccountBalanceIcon fontSize="small" />} label="Outstanding" value={formatMoney(summary?.totalOutstanding)} color="#C2410C" />
          <StatTile
            icon={<HourglassEmptyIcon fontSize="small" />}
            label={`Not yet invoiced${summary?.unbilledCount ? ` · ${summary.unbilledCount} visit${summary.unbilledCount === 1 ? "" : "s"}` : ""}`}
            value={formatMoney(summary?.unbilledAmount)}
            color="#B45309"
          />
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1F5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Visits</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>{filteredVisits.length} of {visits.length} visit{visits.length === 1 ? "" : "s"}, most recent first</p>
          </div>
          {visits.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label style={{ position: "relative" }}>
                <SearchIcon sx={{ position: "absolute", left: 9, top: 8, fontSize: 16, color: "#9CA3AF" }} />
                <input aria-label="Search visits" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search learner or space" style={{ ...inputStyle, width: 200, paddingLeft: 30 }} />
              </label>
              <select aria-label="Filter billing status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 140 }}>
                <option value="all">All statuses</option>
                {Object.entries(VISIT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          )}
        </div>

        {visitsLoading ? (
          <LoadingState label="Loading visits…" />
        ) : filteredVisits.length === 0 ? (
          <EmptyState
            icon={EventAvailableIcon}
            title={visits.length === 0 ? "No visits logged yet" : "No matching visits"}
            subtitle={
              visits.length > 0
                ? "Try a different search or status filter."
                : readOnly
                  ? "This hub hasn't logged any visits yet."
                  : hasSpaces
                    ? "Log a visit each time a learner uses one of this hub's spaces — it's billed automatically as long as their guardian is on file."
                    : "Add a space to this hub in Settings → Learning Hubs before you can log a visit."
            }
          />
        ) : (
          filteredVisits.map((v) => {
            const canOpenInvoice = !!v.invoiceId;
            const openInvoice = () => canOpenInvoice && navigate(`${billingBasePath}/${v.invoiceId}`);
            return (
              <div
                key={v.id}
                role={canOpenInvoice ? "button" : "listitem"}
                tabIndex={canOpenInvoice ? 0 : undefined}
                {...(canOpenInvoice ? rowHoverHandlers : {})}
                onClick={canOpenInvoice ? openInvoice : undefined}
                onKeyDown={canOpenInvoice ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openInvoice(); } } : undefined}
                title={canOpenInvoice ? "View invoice" : undefined}
                style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(200px, 1fr) auto", alignItems: "center", gap: 16, transition: "background .12s", cursor: canOpenInvoice ? "pointer" : "default" }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13, color: "#111827" }}>{learnerName(v.learnerId)}</strong>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{spaceName(v.spaceId)} <span style={{ color: "#CBD5E1" }}>·</span> {v.visitDate}{v.hours ? ` · ${v.hours}h` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <VisitStatusPill status={v.billingStatus} />
                  <strong style={{ fontSize: 14, fontWeight: 850, color: "#111827", minWidth: 90, textAlign: "right" }}>{formatMoney(v.amount)}</strong>
                  {!readOnly && v.billingStatus !== "invoiced" && (
                    <button type="button" onClick={(event) => { event.stopPropagation(); deleteVisit(v.id); }} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!readOnly && showLogVisit && (
        <LogVisitModal hubId={hubId} learners={learners} spaces={spaces} onClose={() => setShowLogVisit(false)} />
      )}
    </div>
  );
}
