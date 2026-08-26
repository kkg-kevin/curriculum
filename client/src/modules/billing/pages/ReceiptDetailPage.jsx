import { useNavigate, useParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon, CheckCircle as CheckCircleIcon } from "@mui/icons-material";
import { useAuth } from "../../../context/AuthContext";
import { useReceiptQuery } from "../hooks/useBilling";
import { cardStyle, formatMoney, formatDate } from "../components/shared";
import BillToCard from "../components/BillToCard";
import BrandMark from "../components/BrandMark";
import DocumentActions from "../components/DocumentActions";
import { LoadingState, ErrorState } from "../components/PageStates";

export default function ReceiptDetailPage() {
  const { invoiceId, paymentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: receipt, isLoading, isError } = useReceiptQuery(invoiceId, paymentId);

  const receiptsPath = user?.role === "learner" ? "/learner-portal/receipts" : user?.role === "school" ? "/school-portal/billing/receipts" : "/billing/receipts";
  const invoicePath = user?.role === "learner" ? "/learner-portal/invoices" : user?.role === "school" ? "/school-portal/billing" : "/billing";

  if (isLoading) return <LoadingState label="Loading receipt…" />;
  if (isError || !receipt) return <ErrorState label="Receipt could not be loaded." detail="It may have been removed, or you may not have access to it." />;

  return (
    <div id="receipt-document" style={{ fontFamily: "Inter, sans-serif", color: "#111827", display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" className="no-print" onClick={() => navigate(receiptsPath)} style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", padding: 0, border: 0, background: "transparent", color: "#6B7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><ArrowBackIcon sx={{ fontSize: 17 }} /> Back to receipts</button>

      <section style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 52%, #2e7db5 100%)", borderRadius: 18, padding: "24px 28px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <BrandMark />
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 14 }}><CheckCircleIcon sx={{ fontSize: 16 }} /> Payment receipt</div>
          <h1 style={{ margin: "8px 0 5px", fontSize: 24, fontWeight: 900 }}>{receipt.receiptNumber}</h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,.74)", fontSize: 13 }}>Payment for invoice {receipt.invoice?.invoiceNumber} · Received {formatDate(receipt.paidAt)}</p>
        </div>
        <DocumentActions targetId="receipt-document" filename={`${receipt.receiptNumber}.pdf`} />
      </section>

      <BillToCard billTo={receipt.billTo} label="Received from" />

      <section style={{ ...cardStyle, padding: "24px 22px" }}>
        <div style={{ textAlign: "center", padding: "10px 0 24px" }}>
          <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Amount received</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#047857", marginTop: 6 }}>{formatMoney(receipt.amount, receipt.invoice?.currency)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 20, borderTop: "1px solid #EEF1F5", paddingTop: 20 }}>
          <div><div style={{ color: "#9CA3AF", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>Payment method</div><div style={{ marginTop: 4, fontSize: 13, color: "#374151", textTransform: "capitalize" }}>{(receipt.paymentMethod || receipt.provider || "").replaceAll("_", " ")}</div></div>
          <div><div style={{ color: "#9CA3AF", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>Date received</div><div style={{ marginTop: 4, fontSize: 13, color: "#374151" }}>{formatDate(receipt.paidAt)}</div></div>
          <div><div style={{ color: "#9CA3AF", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>Reference</div><div style={{ marginTop: 4, fontSize: 13, color: "#374151" }}>{receipt.providerReference || "Not provided"}</div></div>
          <div><div style={{ color: "#9CA3AF", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>Applied to invoice</div><div style={{ marginTop: 4, fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 8 }}><span>{receipt.invoice?.invoiceNumber}</span><button type="button" className="no-print" onClick={() => navigate(`${invoicePath}/${receipt.invoiceId}`)} style={{ padding: 0, border: 0, background: "transparent", color: "#25476a", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", fontSize: 12 }}>View invoice</button></div></div>
        </div>
        {receipt.notes && <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #EEF1F5" }}><div style={{ color: "#9CA3AF", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>Notes</div><p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B7280", whiteSpace: "pre-wrap" }}>{receipt.notes}</p></div>}
      </section>

      <p className="no-print" style={{ margin: 0, textAlign: "center", fontSize: 11, color: "#9CA3AF" }}>This receipt is auto-generated and confirms payment was received against the invoice above.</p>
    </div>
  );
}
