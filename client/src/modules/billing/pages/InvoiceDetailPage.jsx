import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon, CancelOutlined as CancelOutlinedIcon, DescriptionOutlined as DescriptionOutlinedIcon, EventNote as EventNoteIcon, Paid as PaidIcon, Send as SendIcon } from "@mui/icons-material";
import { useAuth } from "../../../context/AuthContext";
import { useCancelInvoice, useInvoiceQuery, useIssueInvoice, usePayInvoice } from "../hooks/useBilling";
import { cardStyle, buttonStyle, formatMoney, formatDate, rowHoverHandlers } from "../components/shared";
import StatusPill, { TYPE_LABELS } from "../components/StatusPill";
import BillToCard from "../components/BillToCard";
import BrandMark from "../components/BrandMark";
import DocumentActions from "../components/DocumentActions";
import { LoadingState, ErrorState } from "../components/PageStates";

function Detail({ label, value }) { return <div><div style={{ color: "#9CA3AF", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 4, color: "#374151", fontSize: 13 }}>{value || "Not provided"}</div></div>; }

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: invoice, isLoading, isError } = useInvoiceQuery(id);
  const { mutate: issueInvoice, isPending: issuing } = useIssueInvoice();
  const { mutate: cancelInvoice, isPending: cancelling } = useCancelInvoice();
  const { mutate: payInvoice, isPending: recordingPayment } = usePayInvoice();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const basePath = user?.role === "learner" ? "/learner-portal/invoices" : user?.role === "school" ? "/school-portal/billing" : "/billing";
  const receiptsBasePath = user?.role === "learner" ? "/learner-portal/receipts" : user?.role === "school" ? "/school-portal/billing/receipts" : "/billing/receipts";

  if (isLoading) return <LoadingState label="Loading invoice…" />;
  if (isError || !invoice) return <ErrorState label="Invoice could not be loaded." detail="It may have been removed, or you may not have access to it." />;

  const canManage = user?.role !== "learner";
  const paymentSubmit = (event) => {
    event.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) return;
    payInvoice({ id: invoice.id, data: { amount: Number(paymentAmount), paymentMethod, paymentDate, providerReference: paymentReference || null, notes: paymentNotes || null } }, { onSuccess: () => { setPaymentAmount(""); setPaymentReference(""); setPaymentNotes(""); } });
  };
  return (
    <div id="invoice-document" style={{ fontFamily: "Inter, sans-serif", color: "#111827", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" className="no-print" onClick={() => navigate(basePath)} style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", padding: 0, border: 0, background: "transparent", color: "#6B7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><ArrowBackIcon sx={{ fontSize: 17 }} /> Back to invoices</button>

      <section style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 52%, #2e7db5 100%)", borderRadius: 18, padding: "24px 28px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <BrandMark />
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 14 }}><DescriptionOutlinedIcon sx={{ fontSize: 16 }} /> Invoice details</div>
          <h1 style={{ margin: "8px 0 5px", fontSize: 24, fontWeight: 900 }}>{invoice.invoiceNumber}</h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,.74)", fontSize: 13 }}>{TYPE_LABELS[invoice.invoiceType]} · Issued {formatDate(invoice.issuedAt, "not yet")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <StatusPill status={invoice.status} />
          <DocumentActions kind="invoice" doc={invoice} targetId="invoice-document" filename={`${invoice.invoiceNumber}.pdf`} />
          <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {canManage && invoice.status === "draft" && <button type="button" disabled={issuing} onClick={() => issueInvoice(invoice.id)} style={{ ...buttonStyle, background: "#feb139", color: "#17304B" }}><SendIcon sx={{ fontSize: 16 }} />{issuing ? "Issuing…" : "Issue invoice"}</button>}
            {canManage && ["draft", "issued", "overdue"].includes(invoice.status) && <button type="button" disabled={cancelling} onClick={() => cancelInvoice(invoice.id)} style={{ ...buttonStyle, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.3)" }}><CancelOutlinedIcon sx={{ fontSize: 17 }} />Cancel</button>}
          </div>
        </div>
      </section>

      <BillToCard billTo={invoice.billTo} label="Bill to" />

      <section style={{ ...cardStyle, padding: "20px 22px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 20 }}><Detail label="Invoice type" value={TYPE_LABELS[invoice.invoiceType]} /><Detail label="Created" value={formatDate(invoice.createdAt)} /><Detail label="Due date" value={formatDate(invoice.dueAt, "No due date")} /><Detail label="Billing period" value={invoice.periodLabel} /><Detail label="Currency" value={invoice.currency} />{invoice.pricingMode === "per_learner" && <><Detail label="Pricing basis" value={`${formatMoney(invoice.unitAmount, invoice.currency)} per learner`} /><Detail label="Learners charged" value={invoice.learnerCount} /><Detail label="Classes included" value={invoice.classCount} /></>}</section>

      <section style={{ ...cardStyle, overflow: "hidden" }}><div style={{ padding: "17px 22px", borderBottom: "1px solid #EEF1F5" }}><h2 style={{ margin: 0, fontSize: 15 }}>Invoice items</h2></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}><thead><tr>{["Description", "Quantity", "Unit amount", "Total"].map((heading) => <th key={heading} style={{ padding: "11px 22px", textAlign: heading === "Description" ? "left" : "right", color: "#9CA3AF", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #EEF1F5" }}>{heading}</th>)}</tr></thead><tbody>{invoice.items?.map((item) => <tr key={item.id}><td style={{ padding: "14px 22px", fontSize: 13, color: "#374151" }}>{item.description}</td><td style={{ padding: "14px 22px", textAlign: "right", fontSize: 13, color: "#6B7280" }}>{item.quantity}</td><td style={{ padding: "14px 22px", textAlign: "right", fontSize: 13, color: "#6B7280" }}>{formatMoney(item.unitAmount, invoice.currency)}</td><td style={{ padding: "14px 22px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#25476a" }}>{formatMoney(item.totalAmount, invoice.currency)}</td></tr>)}</tbody></table></div><div style={{ borderTop: "1px solid #EEF1F5", padding: "16px 22px", marginLeft: "auto", maxWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280" }}><span>Subtotal</span><span>{formatMoney(invoice.subtotal, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280" }}><span>Discount</span><span>- {formatMoney(invoice.discount, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #E5E7EB", fontSize: 15, fontWeight: 850, color: "#25476a" }}><span>Total</span><span>{formatMoney(invoice.total, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: invoice.amountDue > 0 ? "#C2410C" : "#047857" }}><span>Amount due</span><span>{formatMoney(invoice.amountDue, invoice.currency)}</span></div></div></section>

      <section style={{ ...cardStyle, padding: "20px 22px" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}><PaidIcon sx={{ color: "#38aae1", fontSize: 20 }} /> Payment history</h2>
        {invoice.payments?.length ? <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{invoice.payments.map((payment) => (
          <div key={payment.id} role="button" tabIndex={0} {...rowHoverHandlers} onClick={() => navigate(`${receiptsBasePath}/${invoice.id}/${payment.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`${receiptsBasePath}/${invoice.id}/${payment.id}`); } }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 9, cursor: "pointer", transition: "background .12s" }}>
            <div><div style={{ fontSize: 13, fontWeight: 700 }}>{payment.receiptNumber || payment.paymentMethod || payment.provider}</div><div style={{ marginTop: 3, fontSize: 11, color: "#6B7280" }}>{formatDate(payment.paidAt)} · {(payment.paymentMethod || payment.provider || "").replaceAll("_", " ")} · {payment.status}</div></div>
            <strong style={{ color: "#047857", fontSize: 13 }}>{formatMoney(payment.amount, invoice.currency)}</strong>
          </div>
        ))}</div> : <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9CA3AF", fontSize: 13 }}><EventNoteIcon sx={{ fontSize: 18 }} /> No payments recorded yet.</div>}
      </section>

      {canManage && ["issued", "partially_paid", "overdue"].includes(invoice.status) && <section className="no-print" style={{ ...cardStyle, padding: "20px 22px" }}><h2 style={{ margin: "0 0 5px", fontSize: 15 }}>Record payment</h2><p style={{ margin: "0 0 14px", color: "#6B7280", fontSize: 12 }}>Record money received manually. The invoice status will update from the payment ledger.</p><form onSubmit={paymentSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, alignItems: "end" }}><label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: "#374151" }}>Amount<input required type="number" min="0.01" max={invoice.amountDue} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={String(invoice.amountDue)} style={{ padding: "9px 10px", border: "1px solid #D7DEE8", borderRadius: 8, fontFamily: "inherit" }} /></label><label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: "#374151" }}>Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} style={{ padding: "9px 10px", border: "1px solid #D7DEE8", borderRadius: 8, fontFamily: "inherit" }}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="mpesa_manual">M-Pesa</option><option value="cheque">Cheque</option></select></label><label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: "#374151" }}>Payment date<input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} style={{ padding: "9px 10px", border: "1px solid #D7DEE8", borderRadius: 8, fontFamily: "inherit" }} /></label><label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: "#374151" }}>Reference<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Receipt or bank ref" style={{ padding: "9px 10px", border: "1px solid #D7DEE8", borderRadius: 8, fontFamily: "inherit" }} /></label><button type="submit" disabled={recordingPayment || !paymentAmount} style={buttonStyle}>{recordingPayment ? "Recording…" : "Record payment"}</button><label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: "#374151" }}>Notes<textarea value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} rows={2} placeholder="Optional payment notes" style={{ padding: "9px 10px", border: "1px solid #D7DEE8", borderRadius: 8, resize: "vertical", fontFamily: "inherit" }} /></label></form></section>}

      {canManage && invoice.auditEvents?.length > 0 && <section className="no-print" style={{ ...cardStyle, padding: "20px 22px" }}><h2 style={{ margin: "0 0 12px", fontSize: 15 }}>Activity history</h2><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{invoice.auditEvents.map((event) => <div key={event.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid #F3F4F6", fontSize: 12 }}><span style={{ color: "#374151", fontWeight: 700 }}>{event.eventType.replaceAll("_", " ")}</span><span style={{ color: "#9CA3AF" }}>{formatDate(event.createdAt)}{event.amount ? ` · ${formatMoney(event.amount, invoice.currency)}` : ""}</span></div>)}</div></section>}

      {invoice.notes && <section style={{ ...cardStyle, padding: "20px 22px" }}><h2 style={{ margin: "0 0 8px", fontSize: 15 }}>Notes</h2><p style={{ margin: 0, color: "#6B7280", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{invoice.notes}</p></section>}
    </div>
  );
}
