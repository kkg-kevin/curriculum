import { useNavigate, useParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon, CancelOutlined as CancelOutlinedIcon, CheckCircle as CheckCircleIcon, DescriptionOutlined as DescriptionOutlinedIcon, EventNote as EventNoteIcon, Paid as PaidIcon, Send as SendIcon } from "@mui/icons-material";
import { useAuth } from "../../../context/AuthContext";
import { useCancelInvoice, useInvoiceQuery, useIssueInvoice } from "../hooks/useBilling";

const TYPE_LABELS = { hub_subscription: "Hub subscription", learner_term: "Learner per term", course_module: "Course / module", bootcamp: "One-time bootcamp" };
const STATUS_LABELS = { draft: "Draft", issued: "Issued", partially_paid: "Partially paid", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled", void: "Void" };
const STATUS_COLORS = { draft: ["#F3F4F6", "#4B5563"], issued: ["#EFF6FF", "#1D4ED8"], partially_paid: ["#FFF7ED", "#C2410C"], paid: ["#ECFDF5", "#047857"], overdue: ["#FEF2F2", "#B91C1C"], cancelled: ["#F9FAFB", "#6B7280"], void: ["#F9FAFB", "#6B7280"] };
const cardStyle = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14 };
const buttonStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", border: 0, borderRadius: 8, background: "#25476a", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

function formatMoney(amount, currency = "KES") { return `${currency} ${Number(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "Not set"; }
function StatusPill({ status }) { const [background, color] = STATUS_COLORS[status] || STATUS_COLORS.draft; return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 999, background, color, fontSize: 12, fontWeight: 800 }}>{status === "paid" && <CheckCircleIcon sx={{ fontSize: 15 }} />}{STATUS_LABELS[status] || status}</span>; }
function Detail({ label, value }) { return <div><div style={{ color: "#9CA3AF", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 4, color: "#374151", fontSize: 13 }}>{value || "Not provided"}</div></div>; }

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: invoice, isLoading, isError } = useInvoiceQuery(id);
  const { mutate: issueInvoice, isPending: issuing } = useIssueInvoice();
  const { mutate: cancelInvoice, isPending: cancelling } = useCancelInvoice();
  const basePath = user?.role === "learner" ? "/learner-portal/invoices" : user?.role === "school" ? "/school-portal/billing" : "/billing";

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: "#6B7280", fontFamily: "Inter, sans-serif" }}>Loading invoice…</div>;
  if (isError || !invoice) return <div style={{ ...cardStyle, padding: 24, color: "#B91C1C", fontFamily: "Inter, sans-serif" }}>Invoice could not be loaded.</div>;

  const canManage = user?.role !== "learner";
  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#111827", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" onClick={() => navigate(basePath)} style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", padding: 0, border: 0, background: "transparent", color: "#6B7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><ArrowBackIcon sx={{ fontSize: 17 }} /> Back to invoices</button>

      <section style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 52%, #2e7db5 100%)", borderRadius: 18, padding: "24px 28px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}><DescriptionOutlinedIcon sx={{ fontSize: 16 }} /> Invoice details</div><h1 style={{ margin: "8px 0 5px", fontSize: 24, fontWeight: 900 }}>{invoice.invoiceNumber}</h1><p style={{ margin: 0, color: "rgba(255,255,255,.74)", fontSize: 13 }}>{TYPE_LABELS[invoice.invoiceType]} · Issued {formatDate(invoice.issuedAt)}</p></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><StatusPill status={invoice.status} />{canManage && invoice.status === "draft" && <button type="button" disabled={issuing} onClick={() => issueInvoice(invoice.id)} style={{ ...buttonStyle, background: "#feb139", color: "#17304B" }}><SendIcon sx={{ fontSize: 16 }} />{issuing ? "Issuing…" : "Issue invoice"}</button>}{canManage && ["draft", "issued", "overdue"].includes(invoice.status) && <button type="button" disabled={cancelling} onClick={() => cancelInvoice(invoice.id)} style={{ ...buttonStyle, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.3)" }}><CancelOutlinedIcon sx={{ fontSize: 17 }} />Cancel</button>}</div>
      </section>

      <section style={{ ...cardStyle, padding: "20px 22px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 20 }}><Detail label="Invoice type" value={TYPE_LABELS[invoice.invoiceType]} /><Detail label="Created" value={formatDate(invoice.createdAt)} /><Detail label="Due date" value={formatDate(invoice.dueAt)} /><Detail label="Billing period" value={invoice.periodLabel} /><Detail label="Currency" value={invoice.currency} /></section>

      <section style={{ ...cardStyle, overflow: "hidden" }}><div style={{ padding: "17px 22px", borderBottom: "1px solid #EEF1F5" }}><h2 style={{ margin: 0, fontSize: 15 }}>Invoice items</h2></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}><thead><tr>{["Description", "Quantity", "Unit amount", "Total"].map((heading) => <th key={heading} style={{ padding: "11px 22px", textAlign: heading === "Description" ? "left" : "right", color: "#9CA3AF", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #EEF1F5" }}>{heading}</th>)}</tr></thead><tbody>{invoice.items?.map((item) => <tr key={item.id}><td style={{ padding: "14px 22px", fontSize: 13, color: "#374151" }}>{item.description}</td><td style={{ padding: "14px 22px", textAlign: "right", fontSize: 13, color: "#6B7280" }}>{item.quantity}</td><td style={{ padding: "14px 22px", textAlign: "right", fontSize: 13, color: "#6B7280" }}>{formatMoney(item.unitAmount, invoice.currency)}</td><td style={{ padding: "14px 22px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#25476a" }}>{formatMoney(item.totalAmount, invoice.currency)}</td></tr>)}</tbody></table></div><div style={{ borderTop: "1px solid #EEF1F5", padding: "16px 22px", marginLeft: "auto", maxWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280" }}><span>Subtotal</span><span>{formatMoney(invoice.subtotal, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280" }}><span>Discount</span><span>- {formatMoney(invoice.discount, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #E5E7EB", fontSize: 15, fontWeight: 850, color: "#25476a" }}><span>Total</span><span>{formatMoney(invoice.total, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: invoice.amountDue > 0 ? "#C2410C" : "#047857" }}><span>Amount due</span><span>{formatMoney(invoice.amountDue, invoice.currency)}</span></div></div></section>

      <section style={{ ...cardStyle, padding: "20px 22px" }}><h2 style={{ margin: "0 0 14px", fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}><PaidIcon sx={{ color: "#38aae1", fontSize: 20 }} /> Payment history</h2>{invoice.payments?.length ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{invoice.payments.map((payment) => <div key={payment.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 9, background: "#F8FAFC" }}><div><div style={{ fontSize: 13, fontWeight: 700 }}>{payment.paymentMethod || payment.provider}</div><div style={{ marginTop: 3, fontSize: 11, color: "#6B7280" }}>{formatDate(payment.paidAt)} · {payment.status}</div></div><strong style={{ color: "#047857", fontSize: 13 }}>{formatMoney(payment.amount, invoice.currency)}</strong></div>)}</div> : <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9CA3AF", fontSize: 13 }}><EventNoteIcon sx={{ fontSize: 18 }} /> No payments recorded yet.</div>}</section>

      {invoice.notes && <section style={{ ...cardStyle, padding: "20px 22px" }}><h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Notes</h2><p style={{ margin: 0, color: "#6B7280", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{invoice.notes}</p></section>}
    </div>
  );
}
