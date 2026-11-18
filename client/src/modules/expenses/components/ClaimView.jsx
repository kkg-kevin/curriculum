import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCheck, FiCornerUpLeft, FiDollarSign, FiEdit2, FiMapPin, FiRotateCcw, FiSend, FiTrash2, FiX } from "react-icons/fi";
import { BRAND, FONT, card, cardHeading, pill } from "../../../theme/brand";
import { askConfirm, askText } from "../../../components/ui/AskDialog";
import { HistoryButton } from "../../activity/components/RecordStamp";
import { ACTION_WORD, METHOD, errorOf, expensesApi, formatDay, formatMoney, formatWhen, kenyaToday } from "../services/expensesApi";
import { Modal, ProofFile, StatusPill, btn, danger, hint, input, label, primary } from "./ui";

// One expense claim, for whoever may see it: the claimant (edit, send, take back, delete), its
// supervisor or an approver (approve — turning single lines down if need be —, send back,
// decline), and whoever pays (record the payment). Each line shows its proof; nothing is flagged
// (removed 18 Nov 2026 at the user's request) — the reviewer judges what they see.

const ROLE_WORD = { admin: "Admin", collaborator: "Staff", teacher: "Educator", supervisor: "Supervisor" };

function PayForm({ claim, onDone, onCancel }) {
  const [method, setMethod] = useState("mpesa");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(kenyaToday());
  const [note, setNote] = useState("");
  const pay = useMutation({
    mutationFn: () => expensesApi.pay(claim.id, { method, reference: reference.trim() || null, paidAt, note: note.trim() || null }),
    onSuccess: (saved) => { toast.success("Payment recorded"); onDone(saved); },
    onError: (err) => toast.error(errorOf(err, "Couldn't record the payment")),
  });
  const needsRef = method === "mpesa" || method === "bank";
  return (
    <section style={{ ...card, padding: 14, display: "grid", gap: 10, gridTemplateColumns: "100%", borderColor: BRAND.skyBorder, background: BRAND.skyTint }}>
      <h3 style={cardHeading}><FiDollarSign size={13} /> Record the payment — {formatMoney(claim.approvedAmount, claim.currency)}</h3>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))" }}>
        <label style={label}>Paid by
          <select style={input} value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label style={label}>{method === "mpesa" ? "M-Pesa code" : method === "bank" ? "Bank reference" : "Reference (optional)"}
          <input style={input} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder={needsRef ? "Required" : ""} />
        </label>
        <label style={label}>Date paid
          <input type="date" style={input} value={paidAt} max={kenyaToday()} onChange={(e) => setPaidAt(e.target.value)} />
        </label>
      </div>
      <label style={label}>Note (optional)
        <input style={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={primary} disabled={pay.isPending || (needsRef && !reference.trim())} onClick={() => pay.mutate()}><FiCheck size={14} /> {pay.isPending ? "Saving…" : "Mark as paid"}</button>
        <button type="button" style={btn} onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

function Line({ item, claim, reviewing, decision, setDecision }) {
  const turnedDown = reviewing ? decision?.rejected : item.status === "rejected";
  return (
    <section style={{ ...card, padding: 14, display: "grid", gap: 10, gridTemplateColumns: "100%", opacity: turnedDown ? 0.75 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, overflowWrap: "anywhere", textDecoration: turnedDown ? "line-through" : "none" }}>{item.description}</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{formatDay(item.spentOn)}</span><span>·</span><span>{item.categoryLabel}</span>
            {item.vendor && <><span>·</span><span>{item.vendor}</span></>}
            {item.mpesaCode && <><span>·</span><span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: BRAND.inkSoft }}>M-Pesa {item.mpesaCode}</span></>}
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, color: BRAND.ink, whiteSpace: "nowrap" }}>{formatMoney(item.amount, claim.currency)}</div>
      </div>
      {(item.files.length > 0 || item.noReceiptReason) && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          {item.files.map((f) => <ProofFile key={f.id} file={f} />)}
          {item.files.length === 0 && <p style={{ ...hint, fontStyle: "italic" }}>No receipt — "{item.noReceiptReason}"</p>}
        </div>
      )}
      {!reviewing && item.status === "rejected" && (
        <p style={{ ...hint, color: BRAND.danger, fontWeight: 700 }}>Turned down{item.rejectionReason ? `: ${item.rejectionReason}` : ""}</p>
      )}
      {reviewing && (
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, fontWeight: 700, color: decision?.rejected ? BRAND.danger : BRAND.inkSoft, cursor: "pointer" }}>
            <input type="checkbox" checked={!!decision?.rejected} onChange={(e) => setDecision({ rejected: e.target.checked, reason: decision?.reason || "" })} />
            Turn this expense down
          </label>
          {decision?.rejected && <input style={input} value={decision.reason} onChange={(e) => setDecision({ ...decision, reason: e.target.value })} placeholder="Why? The claimant sees this" maxLength={500} />}
        </div>
      )}
    </section>
  );
}

export default function ClaimView({ id, onClose, onEdit }) {
  const qc = useQueryClient();
  const { data: claim, isLoading, error } = useQuery({ queryKey: ["expenses", "claim", id], queryFn: () => expensesApi.get(id) });
  const [lineDecisions, setLineDecisions] = useState({});
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = (saved) => {
    if (saved) qc.setQueryData(["expenses", "claim", id], saved);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };
  const run = async (fn, success) => {
    setBusy(true);
    try {
      const saved = await fn();
      toast.success(success);
      if (saved?.deleted) { qc.invalidateQueries({ queryKey: ["expenses"] }); onClose(); return; }
      refresh(saved);
      setLineDecisions({});
    } catch (err) {
      toast.error(errorOf(err));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || error || !claim) {
    return (
      <Modal title="Expense claim" onClose={onClose}>
        <p style={hint}>{error ? errorOf(error, "This claim can't be opened") : "Loading…"}</p>
      </Modal>
    );
  }

  const can = claim.can || {};
  const reviewing = can.canDecide && claim.status !== "approved";
  const rejectedLines = Object.entries(lineDecisions).filter(([, d]) => d.rejected);
  const approveAmount = claim.items.filter((i) => !lineDecisions[i.id]?.rejected).reduce((s, i) => s + Number(i.amount), 0);
  const linesPayload = () => Object.entries(lineDecisions).map(([lineId, d]) => ({ id: lineId, rejected: !!d.rejected, reason: d.reason?.trim() || null }));

  const approve = async () => {
    if (rejectedLines.some(([, d]) => !d.reason?.trim())) { toast.error("Say why for every expense you turn down"); return; }
    if (rejectedLines.length === claim.items.length) { toast.error("Every expense is turned down — decline the claim instead"); return; }
    const ok = await askConfirm({
      title: "Approve this claim?",
      message: `${formatMoney(approveAmount, claim.currency)} will be approved for ${claim.claimantName}${rejectedLines.length ? `, with ${rejectedLines.length} ${rejectedLines.length === 1 ? "expense" : "expenses"} turned down` : ""}.${can.selfApproval ? " You are the only approver, so it will be marked as approved by the claimant." : ""}`,
      confirmLabel: "Approve",
    });
    if (ok) run(() => expensesApi.decide(claim.id, { decision: "approve", reason: null, lines: linesPayload() }), "Claim approved");
  };
  const sendBack = async () => {
    const reason = await askText({ title: "Send back to change", message: `${claim.claimantName} can change the claim and send it again. Expenses you ticked are marked for them.`, label: "What needs changing?", required: true });
    if (reason) run(() => expensesApi.decide(claim.id, { decision: "return", reason, lines: linesPayload() }), "Sent back");
  };
  const decline = async () => {
    const reason = await askText({ title: "Decline this claim?", message: "Nothing will be paid. The claimant sees your reason.", label: "Reason", required: true, tone: "danger" });
    if (reason) run(() => expensesApi.decide(claim.id, { decision: "reject", reason, lines: [] }), "Claim declined");
  };
  const send = async () => {
    const ok = await askConfirm({ title: "Send this claim?", message: `It goes for approval — ${formatMoney(claim.totalAmount, claim.currency)}.`, confirmLabel: "Send" });
    if (ok) run(() => expensesApi.submit(claim.id), "Claim sent");
  };
  const withdraw = async () => {
    const ok = await askConfirm({ title: "Take this claim back?", message: "It becomes a draft again, so you can change it and send it later.", confirmLabel: "Take back" });
    if (ok) run(() => expensesApi.withdraw(claim.id), "Claim taken back");
  };
  const remove = async () => {
    const ok = await askConfirm({ title: "Delete this draft?", message: "The claim and its receipts are deleted.", confirmLabel: "Delete", tone: "danger" });
    if (ok) run(() => expensesApi.remove(claim.id), "Draft deleted");
  };

  const footer = (
    <>
      {can.canDelete && <button type="button" style={{ ...danger, marginRight: "auto" }} disabled={busy} onClick={remove}><FiTrash2 size={14} /> Delete</button>}
      {can.canWithdraw && <button type="button" style={btn} disabled={busy} onClick={withdraw}><FiRotateCcw size={14} /> Take back</button>}
      {can.canEdit && <button type="button" style={btn} disabled={busy} onClick={() => onEdit(claim)}><FiEdit2 size={14} /> Edit</button>}
      {can.canSubmit && <button type="button" style={primary} disabled={busy} onClick={send}><FiSend size={14} /> Send for approval</button>}
      {can.canDecide && <button type="button" style={danger} disabled={busy} onClick={decline}><FiX size={14} /> Decline</button>}
      {can.canDecide && <button type="button" style={btn} disabled={busy} onClick={sendBack}><FiCornerUpLeft size={14} /> Send back</button>}
      {reviewing && <button type="button" style={primary} disabled={busy} onClick={approve}><FiCheck size={14} /> Approve {formatMoney(approveAmount, claim.currency)}</button>}
      {can.canPay && !paying && <button type="button" style={primary} onClick={() => setPaying(true)}><FiDollarSign size={14} /> Record payment</button>}
    </>
  );
  const hasActions = can.canDelete || can.canWithdraw || can.canEdit || can.canSubmit || can.canDecide || can.canPay;

  return (
    <Modal
      title={`${claim.number ? `${claim.number} · ` : ""}${claim.title}`}
      subtitle={`${claim.claimantName} · ${ROLE_WORD[claim.claimantRole] || ""}${claim.submittedAt ? ` · sent ${formatDay(claim.submittedAt)}` : ""}`}
      onClose={onClose}
      width={860}
      footer={hasActions ? footer : null}
    >
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%", fontFamily: FONT }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <StatusPill status={claim.status} />
          {claim.hubName && <span style={pill("info")}><FiMapPin size={11} /> {claim.hubName}</span>}
          {claim.selfApproved && <span style={pill("danger")}>Self-approved</span>}
          <span style={{ marginLeft: "auto", fontSize: 13, color: BRAND.muted }}>
            Claimed <strong style={{ color: BRAND.ink, fontSize: 15 }}>{formatMoney(claim.totalAmount, claim.currency)}</strong>
            {claim.approvedAmount != null && claim.approvedAmount !== claim.totalAmount && <> · approved <strong style={{ color: BRAND.ink }}>{formatMoney(claim.approvedAmount, claim.currency)}</strong></>}
          </span>
          {!can.isClaimant && <HistoryButton type="expense_claims" id={claim.id} label={claim.number || claim.title} />}
        </div>

        {claim.status === "returned" && claim.returnReason && <div style={{ padding: "10px 12px", borderRadius: 10, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, color: BRAND.goldText, fontSize: 13 }}><strong>Sent back:</strong> {claim.returnReason}</div>}
        {claim.status === "rejected" && claim.rejectionReason && <div style={{ padding: "10px 12px", borderRadius: 10, background: BRAND.dangerTint, border: `1px solid ${BRAND.dangerBorder}`, color: BRAND.danger, fontSize: 13 }}><strong>Declined:</strong> {claim.rejectionReason}</div>}
        {claim.status === "paid" && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: BRAND.navyTint, border: `1px solid ${BRAND.navyBorder}`, color: BRAND.navy, fontSize: 13 }}>
            <strong>Paid {formatMoney(claim.approvedAmount, claim.currency)}</strong> on {formatDay(claim.paidAt)} by {METHOD[claim.paymentMethod] || claim.paymentMethod}{claim.paymentReference ? ` · ref ${claim.paymentReference}` : ""}{claim.paidByName ? ` · recorded by ${claim.paidByName}` : ""}{claim.paymentNote ? ` — ${claim.paymentNote}` : ""}
          </div>
        )}
        {claim.purpose && <p style={{ margin: 0, fontSize: 13.5, color: BRAND.inkSoft, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{claim.purpose}</p>}
        {reviewing && <p style={hint}>Tick any expense you won't pay back and say why — the rest is approved. To have the claimant change something, send it back instead.</p>}

        {claim.items.map((item) => (
          <Line key={item.id} item={item} claim={claim} reviewing={reviewing}
            decision={lineDecisions[item.id]} setDecision={(d) => setLineDecisions((all) => ({ ...all, [item.id]: d }))} />
        ))}

        {claim.removedFiles?.length > 0 && !can.isClaimant && (
          <section style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
            <h3 style={cardHeading}>Files the claimant took off after sending</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{claim.removedFiles.map((f) => <ProofFile key={f.id} file={f} removed />)}</div>
          </section>
        )}

        {paying && <PayForm claim={claim} onCancel={() => setPaying(false)} onDone={(saved) => { setPaying(false); refresh(saved); }} />}

        <section style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
          <h3 style={cardHeading}>What happened</h3>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {claim.timeline.map((e, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, color: BRAND.inkSoft, lineHeight: 1.45 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: e.action === "rejected" ? BRAND.danger : e.action === "returned" ? BRAND.gold : BRAND.mid, marginTop: 5, flexShrink: 0 }} />
                <span><strong>{e.byName}</strong> — {ACTION_WORD[e.action] || e.action}{e.amount != null ? ` (${formatMoney(e.amount, claim.currency)})` : ""}{e.note ? `: ${e.note}` : ""} <span style={{ color: BRAND.faint }}>· {formatWhen(e.at)}</span></span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Modal>
  );
}
