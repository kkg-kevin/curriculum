import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon, Groups as GroupsIcon, Search as SearchIcon } from "@mui/icons-material";
import { useCustomersQuery } from "../hooks/useBilling";
import { inputStyle, formatMoney, formatDate, rowHoverHandlers } from "../components/shared";
import { LoadingState, EmptyState } from "../components/PageStates";

export default function CustomersListPage() {
  const navigate = useNavigate();
  const { data: customersData, isLoading } = useCustomersQuery();
  const customers = customersData?.data || [];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((c) => `${c.name} ${c.email || ""}`.toLowerCase().includes(query));
  }, [customers, search]);

  const stats = useMemo(() => ({
    total: customers.length,
    withBalance: customers.filter((c) => Number(c.balance) > 0).length,
    outstanding: customers.reduce((sum, c) => sum + Number(c.balance || 0), 0),
  }), [customers]);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#111827" }}>
      <button type="button" onClick={() => navigate("/billing")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: 0, background: "transparent", color: "#6B7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}><ArrowBackIcon sx={{ fontSize: 17 }} /> Back to billing</button>

      <div style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 48%, #2e7db5 100%)", borderRadius: 18, padding: "26px 28px", marginBottom: 16, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}><GroupsIcon sx={{ fontSize: 16 }} /> Finance workspace</div>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900 }}>Customers</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.75)" }}>Every learning hub you bill. Open one to add an invoice or generate its statement.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "All customers", value: stats.total, color: "#25476a" },
          { label: "With a balance", value: stats.withBalance, color: "#C2410C" },
          { label: "Total outstanding", value: formatMoney(stats.outstanding), color: "#B91C1C" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 18, fontWeight: 850, color: stat.color, fontVariantNumeric: "tabular-nums" }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1F5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0, fontSize: 16 }}>All customers</h2><p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>{filtered.length} of {customers.length} customer{customers.length === 1 ? "" : "s"}</p></div>
          <label style={{ position: "relative" }}><SearchIcon sx={{ position: "absolute", left: 9, top: 8, fontSize: 16, color: "#9CA3AF" }} /><input aria-label="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" style={{ ...inputStyle, width: 240, paddingLeft: 30 }} /></label>
        </div>

        {isLoading ? <LoadingState label="Loading customers…" /> : filtered.length === 0 ? (
          <EmptyState icon={GroupsIcon} title={customers.length === 0 ? "No customers yet" : "No matching customers"} subtitle={customers.length === 0 ? "Learning hubs appear here once they exist." : "Try a different search term."} />
        ) : filtered.map((customer) => (
          <div
            key={customer.id}
            role="button"
            tabIndex={0}
            {...rowHoverHandlers}
            onClick={() => navigate(`/billing/customers/${customer.id}`)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/billing/customers/${customer.id}`); } }}
            style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(200px, 1.4fr) auto auto", alignItems: "center", gap: 16, cursor: "pointer", transition: "background .12s" }}
          >
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 13, color: "#111827" }}>{customer.name}</strong>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
                {customer.email || "No email"} <span style={{ color: "#CBD5E1" }}>·</span> {customer.invoiceCount} invoice{customer.invoiceCount === 1 ? "" : "s"}
                {customer.lastInvoiceAt && <> <span style={{ color: "#CBD5E1" }}>·</span> last {formatDate(customer.lastInvoiceAt)}</>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#25476a" }}>{formatMoney(customer.totalInvoiced)}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>invoiced</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 110 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: Number(customer.balance) > 0 ? "#C2410C" : "#047857" }}>{formatMoney(customer.balance)}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>{Number(customer.balance) > 0 ? "outstanding" : "settled"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
