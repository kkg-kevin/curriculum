import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon, Storefront as StorefrontIcon } from "@mui/icons-material";
import { useAllHubsRevenueSummaryQuery } from "../hooks/useHubVisits";
import { formatMoney, rowHoverHandlers } from "../../billing/components/shared";
import { LoadingState, EmptyState } from "../../billing/components/PageStates";

// Admin-only cross-hub rollup — "what every non-school hub is making, broken down by learner"
// (D6 in the plan). Each row links into that hub's own Finance tab (LearningHubViewPage.jsx)
// for the per-learner drill-down, same way CustomersListPage.jsx links into CustomerDetailPage
// rather than duplicating that detail view here.
export default function HubRevenueOverviewPage() {
  const navigate = useNavigate();
  const { data: hubsData, isLoading } = useAllHubsRevenueSummaryQuery();
  const hubs = hubsData?.data || [];

  const totals = hubs.reduce((acc, h) => ({
    invoiced: acc.invoiced + Number(h.totalInvoiced || 0),
    paid: acc.paid + Number(h.totalPaid || 0),
    outstanding: acc.outstanding + Number(h.totalOutstanding || 0),
  }), { invoiced: 0, paid: 0, outstanding: 0 });

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#111827" }}>
      <button type="button" onClick={() => navigate("/learning-hubs")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: 0, background: "transparent", color: "#6B7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
        <ArrowBackIcon sx={{ fontSize: 17 }} /> Back to learning hubs
      </button>

      <div style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 48%, #2e7db5 100%)", borderRadius: 18, padding: "26px 28px", marginBottom: 16, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
          <StorefrontIcon sx={{ fontSize: 16 }} /> Finance workspace
        </div>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900 }}>Hub Revenue</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.75)" }}>What every non-school hub is earning from logged space visits, and from whom.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total invoiced", value: formatMoney(totals.invoiced), color: "#25476a" },
          { label: "Total collected", value: formatMoney(totals.paid), color: "#047857" },
          { label: "Total outstanding", value: formatMoney(totals.outstanding), color: "#B91C1C" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 18, fontWeight: 850, color: stat.color, fontVariantNumeric: "tabular-nums" }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1F5" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Non-school hubs</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>{hubs.length} hub{hubs.length === 1 ? "" : "s"} bill learners for space usage</p>
        </div>

        {isLoading ? <LoadingState label="Loading hub revenue…" /> : hubs.length === 0 ? (
          <EmptyState icon={StorefrontIcon} title="No non-school hubs yet" subtitle="Co-working spaces, innovation labs, makerspaces, and tech clubs appear here once they exist." />
        ) : hubs.map((row) => (
          <div
            key={row.hub.id}
            role="button"
            tabIndex={0}
            {...rowHoverHandlers}
            onClick={() => navigate(`/learning-hubs/${row.hub.id}/view`)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/learning-hubs/${row.hub.id}/view`); } }}
            style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(200px, 1.4fr) auto auto auto", alignItems: "center", gap: 16, cursor: "pointer", transition: "background .12s" }}
          >
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 13, color: "#111827" }}>{row.hub.name}</strong>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>{row.visitCount} visit{row.visitCount === 1 ? "" : "s"} logged</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#25476a" }}>{formatMoney(row.totalInvoiced)}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>invoiced</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: Number(row.totalOutstanding) > 0 ? "#C2410C" : "#047857" }}>{formatMoney(row.totalOutstanding)}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>{Number(row.totalOutstanding) > 0 ? "outstanding" : "settled"}</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 90 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: row.unbilledCount > 0 ? "#C2410C" : "#9CA3AF" }}>{formatMoney(row.unbilledAmount)}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>unbilled ({row.unbilledCount})</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
