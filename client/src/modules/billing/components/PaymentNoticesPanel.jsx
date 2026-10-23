import { useState } from "react";
import { Link } from "react-router-dom";
import { usePaymentNotices, useConfirmPaymentNotice, useRejectPaymentNotice } from "../hooks/useBilling";
import { cardStyle, buttonStyle, inputStyle, formatMoney } from "./shared";
import { LoadingState, EmptyState } from "./PageStates";

// Billing → To confirm: families who said "I've paid" on the website's Payment step (Home
// Learning, Tech Club, Bootcamp sign-ups) — an M-Pesa code, a bank transfer reference, a cheque
// number, or cash on its way. Check the money is really there, then Confirm (records the payment;
// a fully paid sign-up switches on by itself) or Reject with a reason the family is told.

const VIEWS = [
  { key: "pending", label: "To confirm" },
  { key: "confirmed", label: "Confirmed" },
  { key: "rejected", label: "Rejected" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

const STATUS_LOOK = {
  pending: { label: "To confirm", bg: "#FFF7ED", color: "#C2410C" },
  confirmed: { label: "Confirmed", bg: "#ECFDF5", color: "#047857" },
  rejected: { label: "Rejected", bg: "#FEF2F2", color: "#B91C1C" },
  closed: { label: "Closed", bg: "#F3F4F6", color: "#6B7280" },
};

// What to check before confirming, per method.
const CHECK_HINT = {
  paybill: "Check the code on your Paybill statement or M-Pesa portal.",
  send_money: "Check the code in the receiving phone's M-Pesa messages.",
  bank_transfer: "Check the transfer on your bank statement.",
  cheque: "Confirm once the cheque has cleared.",
  cash: "Confirm once your team has the cash.",
};

const REFERENCE_LABEL = { paybill: "M-Pesa code", send_money: "M-Pesa code", bank_transfer: "Bank reference", cheque: "Cheque no." };

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const today = () => new Date().toISOString().slice(0, 10);
const subtleButton = { ...buttonStyle, padding: "8px 12px", background: "#F3F4F6", color: "#374151" };

function Pill({ status }) {
  const look = STATUS_LOOK[status] || STATUS_LOOK.pending;
  return <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, background: look.bg, color: look.color, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{look.label}</span>;
}

function Actions({ notice }) {
  const due = notice.invoice?.amountDue ?? notice.amount;
  const [amount, setAmount] = useState(String(Math.min(notice.amount, due || notice.amount)));
  const [date, setDate] = useState(today());
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const { mutate: confirm, isPending: confirming } = useConfirmPaymentNotice();
  const { mutate: reject, isPending: rejectPending } = useRejectPaymentNotice();
  const payable = notice.invoice && ["issued", "partially_paid", "overdue"].includes(notice.invoice.status) && due > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
      {!payable && <div style={{ fontSize: 12, color: "#6B7280" }}>The invoice is {notice.invoice ? notice.invoice.status.replace(/_/g, " ") : "gone"} — there's nothing left to put this on. Reject it if the family needs telling.</div>}
      {payable && <form
        onSubmit={(e) => {
          e.preventDefault();
          if (window.confirm(`Record ${formatMoney(Number(amount))} on ${notice.invoice.invoiceNumber}? Only confirm once the money is really in.`)) confirm({ id: notice.id, amount: Number(amount), paymentDate: date });
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        <input type="number" min="0.01" step="0.01" max={due} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount received" style={{ ...inputStyle, width: 130, padding: "8px 10px" }} />
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Date received" style={{ ...inputStyle, width: 150, padding: "8px 10px" }} />
        <button type="submit" disabled={confirming || !(Number(amount) > 0)} style={{ ...buttonStyle, padding: "8px 12px", background: "#047857" }}>{confirming ? "Recording…" : "Confirm received"}</button>
        <button type="button" onClick={() => setRejecting((v) => !v)} style={subtleButton}>Reject</button>
      </form>}
      {!payable && <button type="button" onClick={() => setRejecting((v) => !v)} style={{ ...subtleButton, alignSelf: "flex-start" }}>Reject</button>}
      {rejecting && (
        <form onSubmit={(e) => { e.preventDefault(); if (reason.trim().length >= 3) reject({ id: notice.id, reason: reason.trim() }); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Why — the family sees this, e.g. no payment with this code" aria-label="Reason" style={{ ...inputStyle, width: 340, padding: "8px 10px" }} />
          <button type="submit" disabled={rejectPending || reason.trim().length < 3} style={{ ...buttonStyle, padding: "8px 12px", background: "#B91C1C" }}>{rejectPending ? "Saving…" : "Reject payment"}</button>
        </form>
      )}
    </div>
  );
}

function NoticeRow({ notice }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 1.3fr) minmax(180px, 1fr) auto", gap: 14, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "#111827" }}>{notice.methodLabel}</strong>
            <Pill status={notice.status} />
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{formatDateTime(notice.createdAt)}</div>
          <div style={{ fontSize: 12, color: "#374151", marginTop: 3 }}>
            {notice.payerName || "Payer not given"}{notice.payerPhone ? ` · ${notice.payerPhone}` : ""}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#374151", minWidth: 0 }}>
          {notice.reference && <div><span style={{ color: "#6B7280" }}>{REFERENCE_LABEL[notice.method] || "Reference"}:</span> <strong style={{ fontFamily: "ui-monospace, monospace" }}>{notice.reference}</strong></div>}
          {notice.invoice && (
            <div style={{ marginTop: 3 }}>
              <Link to={`/billing/${notice.invoice.id}`} style={{ color: "#25476a", fontWeight: 700, textDecoration: "none" }}>{notice.invoice.invoiceNumber}</Link>
              <span style={{ color: "#6B7280" }}> · {formatMoney(notice.invoice.amountDue)} due of {formatMoney(notice.invoice.total)}</span>
            </div>
          )}
          {notice.note && <div style={{ marginTop: 3, color: "#6B7280" }}>“{notice.note}”</div>}
          {notice.status === "pending" && <div style={{ marginTop: 3, color: "#9CA3AF", fontSize: 11.5 }}>{CHECK_HINT[notice.method]}</div>}
          {notice.status !== "pending" && notice.reviewNote && <div style={{ marginTop: 3, color: "#6B7280" }}>{notice.reviewNote}</div>}
        </div>
        <div style={{ textAlign: "right", fontSize: 15, fontWeight: 900, color: "#111827", whiteSpace: "nowrap" }}>{formatMoney(notice.amount)}</div>
      </div>
      {notice.status === "pending" && <Actions notice={notice} />}
    </div>
  );
}

export default function PaymentNoticesPanel() {
  const [view, setView] = useState("pending");
  const { data, isLoading, isError } = usePaymentNotices({ status: view });
  const counts = data?.counts || {};
  const notices = data?.notices || [];

  return (
    <section style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>Payments to confirm</h2>
        <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: "#6B7280" }}>
          Families who told us they've paid at the end of a website sign-up. Confirming records the payment and, once the invoice is fully paid, switches their accounts on. The methods offered are set in Settings → Payments.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {VIEWS.map((v) => (
            <button key={v.key} type="button" onClick={() => setView(v.key)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${view === v.key ? "#25476a" : "#E5E7EB"}`, background: view === v.key ? "#25476a" : "#fff", color: view === v.key ? "#fff" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {v.label}{v.key !== "all" && counts[v.key] ? ` (${counts[v.key]})` : ""}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? <LoadingState label="Loading payments…" inline />
        : isError ? <p style={{ padding: 20, color: "#B91C1C", fontSize: 13 }}>Payments to confirm could not be loaded.</p>
          : notices.length === 0 ? <EmptyState title={view === "pending" ? "Nothing to confirm" : "Nothing here yet"} subtitle={view === "pending" ? "When a family says they've paid, it shows up here." : ""} />
            : notices.map((notice) => <NoticeRow key={notice.id} notice={notice} />)}
    </section>
  );
}
