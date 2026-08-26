import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon, Paid as PaidIcon, Search as SearchIcon } from "@mui/icons-material";
import { useAuth } from "../../../context/AuthContext";
import { useReceiptsQuery } from "../hooks/useBilling";
import { inputStyle, formatMoney, formatDate, rowHoverHandlers } from "../components/shared";
import { LoadingState, EmptyState } from "../components/PageStates";

export default function ReceiptsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: receiptsData, isLoading } = useReceiptsQuery();
  const receipts = receiptsData?.data || [];
  const [search, setSearch] = useState("");

  const basePath = user?.role === "learner" ? "/learner-portal" : user?.role === "school" ? "/school-portal/billing" : "/billing";
  const receiptsPath = user?.role === "learner" ? "/learner-portal/receipts" : user?.role === "school" ? "/school-portal/billing/receipts" : "/billing/receipts";

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return receipts;
    return receipts.filter((r) => `${r.receiptNumber} ${r.invoice?.invoiceNumber || ""}`.toLowerCase().includes(query));
  }, [receipts, search]);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#111827" }}>
      <button type="button" onClick={() => navigate(basePath)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: 0, background: "transparent", color: "#6B7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}><ArrowBackIcon sx={{ fontSize: 17 }} /> Back to billing</button>

      <div style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 48%, #2e7db5 100%)", borderRadius: 18, padding: "26px 28px", marginBottom: 16, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}><PaidIcon sx={{ fontSize: 16 }} /> Finance workspace</div>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900 }}>Receipts</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.75)" }}>Proof of every payment received, with a printable copy for each one.</p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1F5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0, fontSize: 16 }}>All receipts</h2><p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>{filtered.length} of {receipts.length} receipt{receipts.length === 1 ? "" : "s"}</p></div>
          <label style={{ position: "relative" }}><SearchIcon sx={{ position: "absolute", left: 9, top: 8, fontSize: 16, color: "#9CA3AF" }} /><input aria-label="Search receipts" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search receipt or invoice number" style={{ ...inputStyle, width: 240, paddingLeft: 30 }} /></label>
        </div>

        {isLoading ? <LoadingState label="Loading receipts…" /> : filtered.length === 0 ? (
          <EmptyState
            icon={PaidIcon}
            title={receipts.length === 0 ? "No receipts yet" : "No matching receipts"}
            subtitle={receipts.length === 0 ? "Receipts appear automatically once a payment is recorded on an invoice." : "Try a different search term."}
          />
        ) : filtered.map((receipt) => (
          <div
            key={receipt.id}
            role="button"
            tabIndex={0}
            {...rowHoverHandlers}
            onClick={() => navigate(`${receiptsPath}/${receipt.invoiceId}/${receipt.id}`)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`${receiptsPath}/${receipt.invoiceId}/${receipt.id}`); } }}
            style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(200px, 1fr) auto", alignItems: "center", gap: 16, cursor: "pointer", transition: "background .12s" }}
          >
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 13, color: "#111827" }}>{receipt.receiptNumber}</strong>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
                {receipt.invoice?.invoiceNumber || "—"} <span style={{ color: "#CBD5E1" }}>·</span> {(receipt.paymentMethod || receipt.provider || "").replaceAll("_", " ")} <span style={{ color: "#CBD5E1" }}>·</span> {formatDate(receipt.paidAt)}
              </div>
            </div>
            <strong style={{ fontSize: 14, fontWeight: 850, color: "#047857" }}>{formatMoney(receipt.amount, receipt.invoice?.currency)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
