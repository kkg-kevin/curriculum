import { useNavigate, useParams, Link } from "react-router-dom";
import { AccountBalance as AccountBalanceIcon, Add as AddIcon, ArrowBack as ArrowBackIcon, Paid as PaidIcon, ReceiptLong as ReceiptLongIcon } from "@mui/icons-material";
import { useCustomerQuery } from "../hooks/useBilling";
import { cardStyle, buttonStyle, formatMoney, formatDate, rowHoverHandlers } from "../components/shared";
import StatusPill, { TYPE_LABELS } from "../components/StatusPill";
import BillToCard from "../components/BillToCard";
import BrandMark from "../components/BrandMark";
import { LoadingState, ErrorState, EmptyState } from "../components/PageStates";

export default function CustomerDetailPage() {
  const { hubId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useCustomerQuery(hubId);

  if (isLoading) return <LoadingState label="Loading customer…" />;
  if (isError || !data) return <ErrorState label="Customer could not be loaded." detail="The learning hub may have been removed." />;

  const { customer, billTo, summary, invoices, payments } = data;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#111827", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={() => navigate("/billing/customers")} style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", padding: 0, border: 0, background: "transparent", color: "#6B7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><ArrowBackIcon sx={{ fontSize: 17 }} /> Back to customers</button>

      <section style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 52%, #2e7db5 100%)", borderRadius: 18, padding: "24px 28px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <BrandMark />
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 14 }}><AccountBalanceIcon sx={{ fontSize: 16 }} /> Customer</div>
          <h1 style={{ margin: "8px 0 5px", fontSize: 24, fontWeight: 900 }}>{customer.name}</h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,.74)", fontSize: 13 }}>{summary.invoiceCount} invoice{summary.invoiceCount === 1 ? "" : "s"} · {formatMoney(summary.balance)} outstanding</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate(`/billing?tab=invoices&hub=${customer.id}`)} style={{ ...buttonStyle, background: "#feb139", color: "#17304B" }}><AddIcon sx={{ fontSize: 16 }} />Add invoice</button>
          <Link to={`/billing/statements?payer=hub:${customer.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, background: "rgba(255,255,255,.12)", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}><AccountBalanceIcon sx={{ fontSize: 16 }} />View statement</Link>
        </div>
      </section>

      <BillToCard billTo={billTo || { name: customer.name, email: customer.email, phone: customer.phone, address: customer.address }} label="Customer" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Invoices", value: summary.invoiceCount, color: "#25476a" },
          { label: "Total invoiced", value: formatMoney(summary.totalInvoiced), color: "#1D4ED8" },
          { label: "Total paid", value: formatMoney(summary.totalPaid), color: "#047857" },
          { label: "Balance", value: formatMoney(summary.balance), color: Number(summary.balance) > 0 ? "#C2410C" : "#047857" },
        ].map((stat) => (
          <div key={stat.label} style={{ ...cardStyle, padding: "14px 16px" }}>
            <div style={{ fontSize: 18, fontWeight: 850, color: stat.color, fontVariantNumeric: "tabular-nums" }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <section style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1F5", display: "flex", alignItems: "center", gap: 8 }}>
          <ReceiptLongIcon sx={{ color: "#38aae1", fontSize: 20 }} />
          <h2 style={{ margin: 0, fontSize: 15 }}>Invoices</h2>
        </div>
        {invoices.length === 0 ? (
          <EmptyState icon={ReceiptLongIcon} title="No invoices yet" subtitle="Use “Add invoice” above to raise the first one for this customer." />
        ) : invoices.map((invoice) => (
          <div
            key={invoice.id}
            role="button"
            tabIndex={0}
            {...rowHoverHandlers}
            onClick={() => navigate(`/billing/${invoice.id}`)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/billing/${invoice.id}`); } }}
            style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(200px, 1fr) auto", alignItems: "center", gap: 16, cursor: "pointer", transition: "background .12s" }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}><strong style={{ fontSize: 13 }}>{invoice.invoiceNumber}</strong><StatusPill status={invoice.status} size="small" /></div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 5 }}>{TYPE_LABELS[invoice.invoiceType]} <span style={{ color: "#CBD5E1" }}>·</span> Created {formatDate(invoice.createdAt)} <span style={{ color: "#CBD5E1" }}>·</span> Due {formatDate(invoice.dueAt, "No due date")}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 850, color: "#25476a" }}>{formatMoney(invoice.total, invoice.currency)}</div>
              <div style={{ fontSize: 11, color: invoice.amountDue > 0 ? "#C2410C" : "#047857", marginTop: 3 }}>{invoice.amountDue > 0 ? `${formatMoney(invoice.amountDue, invoice.currency)} due` : "Fully paid"}</div>
            </div>
          </div>
        ))}
      </section>

      <section style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1F5", display: "flex", alignItems: "center", gap: 8 }}>
          <PaidIcon sx={{ color: "#38aae1", fontSize: 20 }} />
          <h2 style={{ margin: 0, fontSize: 15 }}>Payments</h2>
        </div>
        {payments.length === 0 ? (
          <EmptyState icon={PaidIcon} title="No payments yet" subtitle="Payments recorded against this customer’s invoices appear here." />
        ) : payments.map((payment) => (
          <div
            key={payment.id}
            role="button"
            tabIndex={0}
            {...rowHoverHandlers}
            onClick={() => navigate(`/billing/receipts/${payment.invoiceId}/${payment.id}`)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/billing/receipts/${payment.invoiceId}/${payment.id}`); } }}
            style={{ padding: "13px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(180px, 1fr) auto", alignItems: "center", gap: 16, cursor: "pointer", transition: "background .12s" }}
          >
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 13 }}>{payment.receiptNumber}</strong>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{payment.invoice?.invoiceNumber || "—"} <span style={{ color: "#CBD5E1" }}>·</span> {(payment.paymentMethod || payment.provider || "").replaceAll("_", " ")} <span style={{ color: "#CBD5E1" }}>·</span> {formatDate(payment.paidAt)}</div>
            </div>
            <strong style={{ fontSize: 13, fontWeight: 850, color: "#047857" }}>{formatMoney(payment.amount, payment.invoice?.currency)}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}
