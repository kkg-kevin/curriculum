import { useEffect, useRef, useState } from "react";
import { Dialog, CircularProgress } from "@mui/material";
import { CheckCircle as CheckCircleIcon, ErrorOutlined as ErrorOutlineIcon, PhoneIphone as PhoneIphoneIcon } from "@mui/icons-material";
import { billingApi } from "../services/billingApi";
import { buttonStyle, inputStyle, formatMoney } from "./shared";

// "Pay with M-Pesa": sends the "enter your M-Pesa PIN" prompt to a phone, then follows it until
// the payer answers. Used on an invoice (a parent paying, or staff pressing Request payment) and
// on the payment-pending screen.
//
//   start({ phone, amount }) → the prompt (from billingApi.mpesaPay / mpesaPayPending)
//   onPaid()                 → called once the money has arrived
//   requestMode              → staff sending the prompt to someone else's phone (different copy)
//   suggestedAmount          → what the amount starts at (e.g. the next part of a payment plan);
//                              the payer can change it, up to what's due

const POLL_MS = 3000;
const GIVE_UP_MS = 150 * 1000;

const wholeShillings = (amount) => Math.max(0, Math.ceil(Number(amount || 0) - 1e-9));

export default function MpesaPayDialog({ open, onClose, amountDue, currency = "KES", defaultPhone = "", start, onPaid, requestMode = false, title, suggestedAmount = null }) {
  const max = wholeShillings(amountDue);
  const initial = suggestedAmount ? Math.min(max, wholeShillings(suggestedAmount)) : max;
  const [phone, setPhone] = useState(defaultPhone || "");
  const [amount, setAmount] = useState(String(initial || ""));
  const [stage, setStage] = useState("form"); // form | sending | waiting | done
  const [request, setRequest] = useState(null);
  const [error, setError] = useState("");
  const startedAt = useRef(0);

  // A fresh form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setPhone(defaultPhone || "");
    setAmount(String(initial || ""));
    setStage("form");
    setRequest(null);
    setError("");
  }, [open, defaultPhone, initial]);

  // Follow the prompt until it's answered (or we stop waiting).
  useEffect(() => {
    if (stage !== "waiting" || !request?.id) return undefined;
    let stopped = false;
    const timer = setInterval(async () => {
      if (Date.now() - startedAt.current > GIVE_UP_MS) {
        clearInterval(timer);
        if (!stopped) setStage("done");
        return;
      }
      try {
        const latest = await billingApi.mpesaRequest(request.id);
        if (stopped) return;
        setRequest(latest);
        if (latest.status !== "pending") {
          clearInterval(timer);
          setStage("done");
          if (latest.status === "successful") onPaid?.(latest);
        }
      } catch {
        // A dropped poll is fine — the next one tries again.
      }
    }, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [stage, request?.id, onPaid]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1) { setError("Enter a whole number of shillings."); return; }
    if (value > max) { setError(`That's more than the ${formatMoney(max, currency)} due.`); return; }
    setStage("sending");
    try {
      const sent = await start({ phone, amount: value });
      startedAt.current = Date.now();
      setRequest(sent);
      setStage("waiting");
    } catch (err) {
      const data = err.response?.data;
      // A prompt was already sent for this invoice a moment ago — follow that one instead.
      if (err.response?.status === 409 && data?.requestId) {
        startedAt.current = Date.now();
        setRequest({ id: data.requestId, status: "pending", message: data.message });
        setStage("waiting");
        return;
      }
      setError(data?.message || err.message || "The payment prompt couldn't be sent.");
      setStage("form");
    }
  };

  const busy = stage === "sending" || stage === "waiting";
  const paid = request?.status === "successful";
  const stillWaiting = stage === "done" && request?.status === "pending";

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <div style={{ padding: "22px 22px 20px", fontFamily: "Inter, sans-serif", color: "#111827" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "#E8F7EE", color: "#15803D", display: "flex", alignItems: "center", justifyContent: "center" }}><PhoneIphoneIcon sx={{ fontSize: 20 }} /></span>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 850 }}>{title || (requestMode ? "Request payment by M-Pesa" : "Pay with M-Pesa")}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>{formatMoney(amountDue, currency)} due</p>
          </div>
        </div>

        {(stage === "form" || stage === "sending") && (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
              {requestMode ? "Payer's M-Pesa number" : "Your M-Pesa number"}
              <input required inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>
              Amount ({currency})
              <input required type="number" min="1" max={max} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
              <span style={{ fontWeight: 500, color: "#6B7280", fontSize: 11.5 }}>Whole shillings. You can pay part now and the rest later.</span>
            </label>
            <p style={{ margin: 0, fontSize: 12, color: "#4B5563", lineHeight: 1.5 }}>
              {requestMode
                ? "The payer's phone will ask them to enter their M-Pesa PIN. The invoice updates as soon as they pay."
                : "Your phone will ask you to enter your M-Pesa PIN. Keep it unlocked and nearby."}
            </p>
            {error && <div style={{ padding: "9px 11px", borderRadius: 8, background: "#FEF2F2", color: "#B91C1C", fontSize: 12.5 }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" onClick={onClose} disabled={stage === "sending"} style={{ ...buttonStyle, background: "#F3F4F6", color: "#374151" }}>Cancel</button>
              <button type="submit" disabled={stage === "sending"} style={{ ...buttonStyle, background: "#15803D" }}>
                {stage === "sending" ? "Sending…" : requestMode ? "Send prompt" : `Pay ${formatMoney(Number(amount) || 0, currency).replace(/\.00$/, "")}`}
              </button>
            </div>
          </form>
        )}

        {stage === "waiting" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "10px 0 4px" }}>
            <CircularProgress size={34} sx={{ color: "#15803D" }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{requestMode ? "Waiting for the payer…" : "Check your phone"}</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>
              {requestMode ? `A prompt was sent to ${request?.phone || "their phone"}.` : "Enter your M-Pesa PIN on the prompt to pay."} This page updates by itself.
            </p>
          </div>
        )}

        {stage === "done" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, padding: "6px 0 2px" }}>
            {paid
              ? <CheckCircleIcon sx={{ fontSize: 44, color: "#15803D" }} />
              : <ErrorOutlineIcon sx={{ fontSize: 44, color: stillWaiting ? "#B45309" : "#B91C1C" }} />}
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
              {paid ? "Payment received" : stillWaiting ? "Still waiting for M-Pesa" : "Not paid"}
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: "#4B5563", lineHeight: 1.5 }}>
              {paid
                ? `${formatMoney(request.amount, currency)} paid${request.receiptNumber ? ` · M-Pesa ${request.receiptNumber}` : ""}.`
                : stillWaiting
                  ? "If you entered your PIN, the payment will show on the invoice once M-Pesa confirms it — usually within a few minutes. There's no need to pay again."
                  : request?.message || "M-Pesa didn't complete the payment."}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {!paid && !stillWaiting && <button type="button" onClick={() => { setStage("form"); setError(""); }} style={buttonStyle}>Try again</button>}
              <button type="button" onClick={onClose} style={{ ...buttonStyle, background: paid ? "#15803D" : "#F3F4F6", color: paid ? "#fff" : "#374151" }}>{paid ? "Done" : "Close"}</button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// "Pay via M-Pesa: Paybill 123456, Account 2026000123" — for paying by hand from the M-Pesa menu.
export function PaybillInstructions({ payBy, compact = false }) {
  if (!payBy) return null;
  return (
    <div style={{ display: "flex", gap: compact ? 14 : 22, flexWrap: "wrap", alignItems: "center" }}>
      <div><div style={{ color: "#6B7280", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>Paybill</div><div style={{ marginTop: 3, fontSize: compact ? 14 : 18, fontWeight: 850, color: "#111827", letterSpacing: ".02em" }}>{payBy.paybill}</div></div>
      <div><div style={{ color: "#6B7280", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>Account number</div><div style={{ marginTop: 3, fontSize: compact ? 14 : 18, fontWeight: 850, color: "#111827", letterSpacing: ".02em" }}>{payBy.account}</div></div>
    </div>
  );
}
