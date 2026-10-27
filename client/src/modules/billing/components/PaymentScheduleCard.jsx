import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CalendarMonth as CalendarIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { billingApi } from "../services/billingApi";
import { usePaymentOptions } from "../../settings/payments/paymentSettingsApi";
import { cardStyle, buttonStyle, inputStyle, formatMoney, formatDate } from "./shared";

// Part payments on an invoice (server: billing/billing.instalments.js). The schedule — each part's
// amount, due date, what's been paid on it and where it stands — and the next part to pay. Staff can
// split the invoice into parts (one of the workspace's plans, equal parts, or typed by hand), change
// them, or remove them; a family sees the schedule and pays the next part.

const STATE = {
  paid: { label: "Paid", bg: "#ECFDF5", color: "#047857" },
  overdue: { label: "Overdue", bg: "#FEF2F2", color: "#B91C1C" },
  due: { label: "Due today", bg: "#FFFBEB", color: "#B45309" },
  upcoming: { label: "Upcoming", bg: "#EFF6FF", color: "#1D4ED8" },
};
const PAYABLE = ["draft", "issued", "partially_paid", "overdue"];

const kenyaToday = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
function addMonths(start, months) {
  const [y, m, d] = start.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
const money = (v) => Number(Number(v || 0).toFixed(2));

// The same split the server makes (billing.instalments.js's scheduleFromPlan): whole shillings, the
// first part a deposit share when there is one, the last taking the difference.
function splitPlan(total, { count, intervalMonths = 1, depositPercent = null }, start) {
  const n = Number(count);
  if (!n || n < 2) return [];
  const even = (amount, parts) => {
    const base = Math.floor(money(amount) / parts);
    return Array.from({ length: parts }, (_, i) => (i === parts - 1 ? money(amount - base * (parts - 1)) : base));
  };
  let amounts;
  if (depositPercent) {
    const first = Math.round((money(total) * Number(depositPercent)) / 100);
    amounts = [first, ...even(money(total - first), n - 1)];
  } else {
    amounts = even(total, n);
  }
  return amounts.map((amount, i) => ({
    label: i === 0 ? (depositPercent ? "Deposit" : "Payment 1") : `Payment ${i + 1}`,
    amount,
    dueDate: i === 0 ? start : addMonths(start, i * (Number(intervalMonths) || 1)),
  }));
}

const smallInput = { ...inputStyle, padding: "7px 9px", fontSize: 12.5 };

function Editor({ invoice, plans, onDone }) {
  const queryClient = useQueryClient();
  const today = kenyaToday();
  const [rows, setRows] = useState(() => (invoice.instalments?.length
    ? invoice.instalments.map((p) => ({ label: p.label, amount: p.amount, dueDate: p.dueDate }))
    : splitPlan(invoice.total, { count: 2, intervalMonths: 1 }, today)));
  const [start, setStart] = useState(today);
  const [count, setCount] = useState(2);
  const [planKey, setPlanKey] = useState(null);
  const [problem, setProblem] = useState("");
  const save = useMutation({
    mutationFn: (data) => billingApi.setInstalments(invoice.id, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["billing", "invoice", invoice.id], data);
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      toast.success(data.instalments?.length ? "Payment schedule saved" : "Payment schedule removed");
      onDone();
    },
    onError: (err) => setProblem(err?.errors?.[0]?.message || err?.message || "The schedule couldn't be saved"),
  });

  const total = money(invoice.total);
  const sum = money(rows.reduce((s, r) => s + money(r.amount), 0));
  const set = (i, key) => (e) => { setPlanKey(null); setRows((list) => list.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r))); };
  const applyPlan = (plan) => { setPlanKey(plan.key); setRows(splitPlan(total, plan, start)); };
  const submit = (e) => {
    e.preventDefault();
    if (sum !== total) return setProblem(`The payments add up to ${formatMoney(sum, invoice.currency)}, not the invoice's ${formatMoney(total, invoice.currency)}.`);
    setProblem("");
    save.mutate({ planKey: planKey || null, instalments: rows.map((r) => ({ label: r.label, amount: money(r.amount), dueDate: r.dueDate })) });
  };

  return (
    <form onSubmit={submit} className="no-print" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #EEF1F5", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, fontWeight: 700, color: "#374151" }}>
          First payment
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...smallInput, width: 150 }} />
        </label>
        {plans.map((plan) => (
          <button key={plan.key} type="button" onClick={() => applyPlan(plan)} style={{ ...buttonStyle, padding: "7px 11px", fontSize: 12, background: planKey === plan.key ? "#25476a" : "#EFF6FB", color: planKey === plan.key ? "#fff" : "#25476a" }}>
            {plan.label}
          </button>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
          or
          <input type="number" min="2" max="24" value={count} onChange={(e) => setCount(e.target.value)} aria-label="Number of equal payments" style={{ ...smallInput, width: 64 }} />
          <button type="button" onClick={() => { setPlanKey(null); setRows(splitPlan(total, { count: Math.min(24, Math.max(2, Number(count) || 2)), intervalMonths: 1 }, start)); }} style={{ ...buttonStyle, padding: "7px 11px", fontSize: 12, background: "#EFF6FB", color: "#25476a" }}>
            equal monthly payments
          </button>
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead><tr>{["Payment", "Due date", "Amount", ""].map((h) => <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "#9CA3AF", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: "4px 8px" }}><input value={r.label} maxLength={80} onChange={set(i, "label")} aria-label={`Payment ${i + 1} name`} style={smallInput} /></td>
                <td style={{ padding: "4px 8px" }}><input type="date" value={r.dueDate} onChange={set(i, "dueDate")} aria-label={`Payment ${i + 1} due date`} style={smallInput} /></td>
                <td style={{ padding: "4px 8px" }}><input type="number" min="0.01" step="0.01" value={r.amount} onChange={set(i, "amount")} aria-label={`Payment ${i + 1} amount`} style={smallInput} /></td>
                <td style={{ padding: "4px 8px", width: 34 }}>
                  {rows.length > 2 && <button type="button" onClick={() => { setPlanKey(null); setRows((list) => list.filter((_, j) => j !== i)); }} aria-label={`Remove payment ${i + 1}`} style={{ border: 0, background: "none", color: "#B91C1C", cursor: "pointer", padding: 4 }}><DeleteIcon sx={{ fontSize: 17 }} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => { setPlanKey(null); setRows((list) => [...list, { label: `Payment ${list.length + 1}`, amount: 0, dueDate: list.length ? addMonths(list[list.length - 1].dueDate, 1) : start }]); }} disabled={rows.length >= 24} style={{ border: 0, background: "none", color: "#25476a", fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          + Add a payment
        </button>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: sum === total ? "#047857" : "#B91C1C" }}>
          Adds up to {formatMoney(sum, invoice.currency)} of {formatMoney(total, invoice.currency)}
        </span>
      </div>
      {problem && <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: 12.5 }}>{problem}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" disabled={save.isPending} style={buttonStyle}>{save.isPending ? "Saving…" : "Save schedule"}</button>
        <button type="button" onClick={onDone} style={{ ...buttonStyle, background: "#fff", color: "#374151", border: "1px solid #D7DEE8" }}>Cancel</button>
        {invoice.instalments?.length > 0 && (
          <button type="button" disabled={save.isPending} onClick={() => { if (window.confirm("Remove the payment schedule? The invoice is then due in one amount.")) save.mutate({}); }} style={{ ...buttonStyle, background: "#fff", color: "#B91C1C", border: "1px solid #FECACA", marginLeft: "auto" }}>
            Remove schedule
          </button>
        )}
      </div>
    </form>
  );
}

// `onPayNext(amount)` — a family paying the next part (opens the M-Pesa prompt), when they can.
export default function PaymentScheduleCard({ invoice, canManage, isAdmin, onPayNext }) {
  const [editing, setEditing] = useState(false);
  const { data: options } = usePaymentOptions({ enabled: isAdmin });
  const plans = isAdmin ? (options?.options?.partPayments?.plans || []) : [];
  const parts = invoice.instalments || [];
  const plan = invoice.paymentPlan || {};
  const canEdit = canManage && PAYABLE.includes(invoice.status) && Number(invoice.amountDue) > 0;
  if (!parts.length && !canEdit && !plan.overdueAmount) return null;
  const planName = plan.key === "custom" ? "Custom schedule" : plans.find((p) => p.key === plan.key)?.label || (parts.length ? "Payment plan" : null);

  return (
    <section style={{ ...cardStyle, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}>
          <CalendarIcon sx={{ color: "#38aae1", fontSize: 20 }} /> Payment schedule
          {planName && parts.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>· {planName}</span>}
        </h2>
        {canEdit && !editing && (
          <button type="button" className="no-print" onClick={() => setEditing(true)} style={{ ...buttonStyle, padding: "7px 12px", fontSize: 12.5, background: "#EFF6FB", color: "#25476a" }}>
            {parts.length ? "Change schedule" : "Split into payments"}
          </button>
        )}
      </div>

      {plan.overdueAmount > 0 && (
        <p style={{ margin: "12px 0 0", padding: "9px 12px", borderRadius: 9, background: "#FEF2F2", color: "#991B1B", fontSize: 12.5, fontWeight: 600 }}>
          {formatMoney(plan.overdueAmount, invoice.currency)} overdue since {formatDate(`${plan.overdueSince}T00:00:00`)}.
        </p>
      )}

      {parts.length > 0 ? (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead><tr>{["Payment", "Due", "Amount", "Paid", ""].map((h, i) => <th key={h || i} style={{ padding: "8px 10px", textAlign: i >= 2 && i <= 3 ? "right" : "left", color: "#9CA3AF", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #EEF1F5" }}>{h}</th>)}</tr></thead>
            <tbody>
              {parts.map((p) => {
                const look = STATE[p.state] || STATE.upcoming;
                const isNext = plan.next?.sequence === p.sequence;
                return (
                  <tr key={p.sequence} style={{ background: isNext ? "#FAFCFF" : "transparent" }}>
                    <td style={{ padding: "10px", fontSize: 13, fontWeight: isNext ? 800 : 600, color: "#111827" }}>{p.label}</td>
                    <td style={{ padding: "10px", fontSize: 13, color: "#374151" }}>{formatDate(`${p.dueDate}T00:00:00`)}</td>
                    <td style={{ padding: "10px", fontSize: 13, textAlign: "right", color: "#374151" }}>{formatMoney(p.amount, invoice.currency)}</td>
                    <td style={{ padding: "10px", fontSize: 13, textAlign: "right", color: p.paid > 0 ? "#047857" : "#9CA3AF" }}>{formatMoney(p.paid, invoice.currency)}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: look.bg, color: look.color, whiteSpace: "nowrap" }}>{p.partPaid && p.state !== "overdue" ? "Part paid" : look.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        !editing && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#6B7280" }}>Due in one amount{invoice.dueAt ? ` by ${formatDate(invoice.dueAt)}` : ""}. Split it into payments to give the payer a plan — they're reminded before each one, and payments count towards the earliest first.</p>
      )}

      {plan.next && !editing && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#374151" }}>
            Next: <strong>{formatMoney(plan.next.amount, invoice.currency)}</strong>{plan.next.dueDate ? ` by ${formatDate(`${plan.next.dueDate}T00:00:00`)}` : ""}{parts.length ? ` (${plan.next.label})` : ""}
          </p>
          {onPayNext && parts.length > 0 && (
            <button type="button" className="no-print" onClick={() => onPayNext(plan.next.amount)} style={{ ...buttonStyle, background: "#15803D" }}>Pay {formatMoney(plan.next.amount, invoice.currency).replace(/\.00$/, "")} now</button>
          )}
        </div>
      )}

      {editing && <Editor invoice={invoice} plans={plans} onDone={() => setEditing(false)} />}
    </section>
  );
}
