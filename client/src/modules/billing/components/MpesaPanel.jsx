import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PhoneIphone as PhoneIphoneIcon, UploadFile as UploadFileIcon } from "@mui/icons-material";
import {
  useMpesaStatus, useMpesaTransactions, useMpesaFailedRequests, useMpesaAllocate, useMpesaIgnore, useMpesaCheck, useMpesaReverse,
  useMpesaStatementPreview, useMpesaStatementImport,
} from "../hooks/useBilling";
import { cardStyle, buttonStyle, inputStyle, formatMoney } from "./shared";
import { LoadingState, EmptyState } from "./PageStates";

// Billing → M-Pesa: every M-Pesa payment into the Paybill, from a phone prompt, paid by hand with
// an account number, or imported from a statement. Most go onto their invoice by themselves; the
// ones that couldn't (a mistyped account number, an invoice already paid, more than was due) wait
// under "To match" for staff to put on the right invoice, set aside, or send back to the payer.

const VIEWS = [
  { key: "to_match", label: "To match", statuses: ["unallocated", "partially_allocated"] },
  { key: "matched", label: "Matched", statuses: ["allocated"] },
  { key: "ignored", label: "Set aside", statuses: ["ignored"] },
  { key: "reversed", label: "Sent back", statuses: ["reversed"] },
  { key: "all", label: "All", statuses: null },
];

const STATUS_LOOK = {
  unallocated: { label: "To match", bg: "#FFF7ED", color: "#C2410C" },
  partially_allocated: { label: "Part matched", bg: "#FFFBEB", color: "#B45309" },
  allocated: { label: "Matched", bg: "#ECFDF5", color: "#047857" },
  ignored: { label: "Set aside", bg: "#F3F4F6", color: "#6B7280" },
  reversed: { label: "Sent back", bg: "#EEF2FF", color: "#4338CA" },
};

const PROMPT_LOOK = {
  cancelled: "Cancelled on the phone",
  failed: "Failed",
  timeout: "No answer",
  error: "Couldn't be sent",
};

const SOURCE_LABEL = { stk: "Phone prompt", c2b: "Paid to Paybill", statement_import: "From statement" };

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const subtleButton = { ...buttonStyle, padding: "8px 12px", background: "#F3F4F6", color: "#374151" };

function Pill({ status }) {
  const look = STATUS_LOOK[status] || STATUS_LOOK.unallocated;
  return <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, background: look.bg, color: look.color, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{look.label}</span>;
}

// What M-Pesa said about a status check or reversal, in a line.
function OperationLine({ op }) {
  const what = op.kind === "reversal" ? "Send back" : "Check with M-Pesa";
  if (op.status === "pending") return <div style={{ fontSize: 12, color: "#6B7280" }}>{what}: waiting for M-Pesa's answer…</div>;
  const ok = op.status === "successful";
  const r = op.result || {};
  const detail = op.kind === "status" && ok
    ? [r.TransactionStatus, r.Amount != null ? `KES ${r.Amount}` : null, r.DebitPartyName, r.ReasonType].filter(Boolean).join(" · ")
    : op.resultDesc;
  return (
    <div style={{ fontSize: 12, color: ok ? "#047857" : "#B45309" }}>
      {what} ({formatDateTime(op.updatedAt || op.createdAt)}): {op.kind === "reversal" && ok ? "sent back to the payer" : null}{detail ? `${op.kind === "reversal" && ok ? " — " : ""}${detail}` : ok ? "" : "no answer"}
    </div>
  );
}

function MatchForm({ tx }) {
  const [invoice, setInvoice] = useState(tx.billRefNumber || "");
  const [note, setNote] = useState("");
  const [asideOpen, setAsideOpen] = useState(false);
  const { mutate: allocate, isPending: allocating } = useMpesaAllocate();
  const { mutate: ignore, isPending: ignoring } = useMpesaIgnore();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
      <form onSubmit={(e) => { e.preventDefault(); if (invoice.trim()) allocate({ id: tx.id, invoice: invoice.trim() }); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Invoice number, e.g. INV-2026-000123" aria-label="Invoice number" style={{ ...inputStyle, width: 260, padding: "8px 10px" }} />
        <button type="submit" disabled={allocating || !invoice.trim()} style={{ ...buttonStyle, padding: "8px 12px" }}>{allocating ? "Matching…" : "Put on invoice"}</button>
        <button type="button" onClick={() => setAsideOpen((v) => !v)} style={subtleButton}>Set aside</button>
      </form>
      {asideOpen && (
        <form onSubmit={(e) => { e.preventDefault(); ignore({ id: tx.id, note: note.trim() || null }); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why, e.g. refunded to the payer" aria-label="Reason" style={{ ...inputStyle, width: 260, padding: "8px 10px" }} />
          <button type="submit" disabled={ignoring} style={{ ...buttonStyle, padding: "8px 12px", background: "#6B7280" }}>{ignoring ? "Saving…" : "Confirm set aside"}</button>
        </form>
      )}
    </div>
  );
}

// Check with M-Pesa (any payment with a receipt) and Send back (money that never went on an
// invoice). Both need the Paybill's API operator (Settings → Payments).
function OperationActions({ tx }) {
  const [reverseOpen, setReverseOpen] = useState(false);
  const [note, setNote] = useState("");
  const { mutate: check, isPending: checking } = useMpesaCheck();
  const { mutate: reverse, isPending: reversing } = useMpesaReverse();
  const pending = tx.operations?.some((op) => op.status === "pending");
  const reversible = ["unallocated", "ignored"].includes(tx.status) && tx.unallocatedAmount === tx.amount && !tx.allocations?.length
    && !tx.operations?.some((op) => op.kind === "reversal" && op.status === "successful");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={checking || pending} onClick={() => check(tx.id)} style={subtleButton}>{checking ? "Asking…" : "Check with M-Pesa"}</button>
        {reversible && <button type="button" disabled={pending} onClick={() => setReverseOpen((v) => !v)} style={subtleButton}>Send back to payer</button>}
      </div>
      {reverseOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (window.confirm(`Send ${formatMoney(tx.amount)} back to ${tx.payerName || tx.phone || "the payer"}? M-Pesa reverses the whole payment, and this can't be undone.`)) {
              reverse({ id: tx.id, note: note.trim() || null }, { onSuccess: () => setReverseOpen(false) });
            }
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder="Why, e.g. paid to the wrong Paybill" aria-label="Reason for sending back" style={{ ...inputStyle, width: 260, padding: "8px 10px" }} />
          <button type="submit" disabled={reversing} style={{ ...buttonStyle, padding: "8px 12px", background: "#4338CA" }}>{reversing ? "Sending…" : `Send back ${formatMoney(tx.amount)}`}</button>
        </form>
      )}
    </div>
  );
}

function TransactionRow({ tx, canQuery }) {
  const waiting = tx.status === "unallocated" || tx.status === "partially_allocated";
  const latest = ["status", "reversal"].map((kind) => tx.operations?.find((op) => op.kind === kind)).filter(Boolean);
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 1.3fr) minmax(160px, 1fr) auto", gap: 14, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "#111827" }}>{tx.transId || "Receipt pending"}</strong>
            <Pill status={tx.status} />
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
            {formatDateTime(tx.transTime || tx.createdAt)} · {SOURCE_LABEL[tx.source] || tx.source}
          </div>
          <div style={{ fontSize: 12, color: "#374151", marginTop: 3 }}>
            {tx.payerName || tx.phone || "Payer not given"}{tx.payerName && tx.phone ? ` · ${tx.phone}` : ""}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#374151", minWidth: 0 }}>
          <div><span style={{ color: "#9CA3AF" }}>Account entered: </span>{tx.billRefNumber || "—"}</div>
          {tx.allocations?.length > 0 && (
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              {tx.allocations.map((a) => (
                <span key={a.paymentId}><Link to={`/billing/${a.invoiceId}`} style={{ color: "#25476a", fontWeight: 700, textDecoration: "none" }}>{a.invoiceNumber}</Link> · {formatMoney(a.amount)}</span>
              ))}
            </div>
          )}
          {tx.note && <div style={{ marginTop: 4, color: waiting ? "#B45309" : "#6B7280" }}>{tx.note}</div>}
          {latest.length > 0 && <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>{latest.map((op) => <OperationLine key={op.id} op={op} />)}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <strong style={{ fontSize: 14, color: tx.status === "reversed" ? "#6B7280" : "#047857" }}>{formatMoney(tx.amount)}</strong>
          {waiting && tx.unallocatedAmount > 0 && tx.unallocatedAmount !== tx.amount && <div style={{ fontSize: 11.5, color: "#C2410C", marginTop: 3 }}>{formatMoney(tx.unallocatedAmount)} to match</div>}
        </div>
      </div>
      {waiting && <MatchForm tx={tx} />}
      {canQuery && tx.transId && tx.status !== "reversed" && <OperationActions tx={tx} />}
    </div>
  );
}

const OUTCOME_LABEL = {
  new: "New",
  already_recorded: "Already recorded",
  allocated: "Put on invoice",
  partially_allocated: "Part on invoice",
  unallocated: "To match",
  duplicate: "Already recorded",
  linked: "Already recorded",
};

// Import an M-Pesa statement (CSV from the M-Pesa business portal): see what's new first, then
// add it. Payments already on file are skipped by their M-Pesa receipt.
function StatementImport() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);
  const preview = useMpesaStatementPreview();
  const importer = useMpesaStatementImport();
  const result = importer.data || preview.data;

  const reset = () => { setCsv(""); setFileName(""); preview.reset(); importer.reset(); if (fileRef.current) fileRef.current.value = ""; };
  const choose = async (file) => {
    if (!file) return;
    importer.reset();
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    preview.mutate(text);
  };

  return (
    <section style={{ ...cardStyle, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <UploadFileIcon sx={{ fontSize: 20, color: "#25476a" }} />
        <span style={{ flex: 1 }}>
          <strong style={{ display: "block", fontSize: 14, color: "#111827" }}>Import an M-Pesa statement</strong>
          <span style={{ fontSize: 12, color: "#6B7280" }}>For payments the Paybill received that aren't here — anything already on file is skipped.</span>
        </span>
        <span style={{ fontSize: 12, color: "#25476a", fontWeight: 700 }}>{open ? "Close" : "Open"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "#4B5563", lineHeight: 1.55 }}>
            In the M-Pesa business portal, open the Paybill's statement, choose the dates and export it as <strong>CSV</strong>. Payments whose account number matches an invoice are put on it; the rest wait under “To match”.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => choose(e.target.files?.[0])} aria-label="M-Pesa statement CSV" style={{ fontSize: 12.5 }} />
            {fileName && <button type="button" onClick={reset} style={subtleButton}>Clear</button>}
          </div>
          {preview.isPending && <div style={{ fontSize: 12.5, color: "#6B7280" }}>Reading the statement…</div>}
          {result && (
            <div style={{ border: "1px solid #EEF1F5", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: result.dryRun ? "#F8FAFC" : "#ECFDF5", fontSize: 12.5, color: "#374151", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <strong>{result.dryRun ? "In this statement" : "Imported"}</strong>
                <span>{result.counts.total} payment{result.counts.total === 1 ? "" : "s"} received</span>
                <span>{result.counts.added} {result.dryRun ? "new" : "added"}</span>
                {!result.dryRun && <span>{result.counts.matched} put on invoices · {result.counts.toMatch} to match</span>}
                <span>{result.counts.alreadyRecorded} already recorded</span>
                {result.counts.skipped > 0 && <span title={result.skipped.slice(0, 8).map((s) => `${s.receipt}: ${s.reason}`).join("\n")}>{result.counts.skipped} skipped (not money received)</span>}
              </div>
              {result.rows.filter((r) => r.outcome !== "already_recorded").slice(0, 40).map((r) => (
                <div key={r.transId} style={{ padding: "8px 14px", borderTop: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(110px, auto) 1fr auto auto", gap: 12, fontSize: 12, alignItems: "center" }}>
                  <strong>{r.transId}</strong>
                  <span style={{ color: "#4B5563", minWidth: 0 }}>{r.payerName || r.msisdn || "—"} · account “{r.billRefNumber || "—"}”{r.invoiceNumber ? ` → ${r.invoiceNumber}` : ""}</span>
                  <span style={{ color: "#6B7280" }}>{OUTCOME_LABEL[r.outcome] || r.outcome}</span>
                  <strong>{formatMoney(r.amount)}</strong>
                </div>
              ))}
              {result.dryRun && (
                <div style={{ padding: "10px 14px", borderTop: "1px solid #EEF1F5", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="button" disabled={!result.counts.added || importer.isPending} onClick={() => importer.mutate(csv)} style={buttonStyle}>
                    {importer.isPending ? "Importing…" : result.counts.added ? `Add ${result.counts.added} payment${result.counts.added === 1 ? "" : "s"}` : "Nothing new to add"}
                  </button>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>Into Paybill {result.paybill}.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function MpesaPanel() {
  const [view, setView] = useState("to_match");
  const { data: status, isLoading: loadingStatus } = useMpesaStatus();
  const { data, isLoading } = useMpesaTransactions();
  const { data: failed = [] } = useMpesaFailedRequests();
  const transactions = useMemo(() => data?.transactions || [], [data]);
  const counts = data?.counts || {};

  const shown = useMemo(() => {
    const def = VIEWS.find((v) => v.key === view);
    return def.statuses ? transactions.filter((tx) => def.statuses.includes(tx.status)) : transactions;
  }, [transactions, view]);
  const countFor = (def) => (def.statuses ? def.statuses.reduce((sum, s) => sum + (counts[s] || 0), 0) : transactions.length);

  if (loadingStatus || isLoading) return <LoadingState label="Loading M-Pesa payments…" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ ...cardStyle, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "#E8F7EE", color: "#15803D", display: "flex", alignItems: "center", justifyContent: "center" }}><PhoneIphoneIcon sx={{ fontSize: 20 }} /></span>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>M-Pesa</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6B7280" }}>
              {status?.enabled
                ? `Paybill ${status.paybill}${status.ownPaybill ? " (your own)" : ""}${status.environment === "sandbox" ? " · test mode (sandbox)" : ""} — payments go onto their invoices by themselves; anything that can't waits here.`
                : "M-Pesa isn't set up for this workspace yet. Once it is, families can pay invoices from their phones and payments appear here."}
            </p>
          </div>
        </div>
      </section>

      {status?.enabled && <StatementImport />}

      <section style={{ ...cardStyle, overflow: "hidden" }}>
        <div role="tablist" style={{ display: "flex", gap: 6, padding: "12px 16px", borderBottom: "1px solid #EEF1F5", flexWrap: "wrap" }}>
          {VIEWS.map((def) => {
            const active = view === def.key;
            const n = countFor(def);
            return (
              <button key={def.key} type="button" role="tab" aria-selected={active} onClick={() => setView(def.key)} style={{ padding: "7px 12px", borderRadius: 999, border: `1.5px solid ${active ? "#25476a" : "#E5E7EB"}`, background: active ? "#25476a" : "#fff", color: active ? "#fff" : "#374151", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                {def.label} <span style={{ opacity: 0.75 }}>{n}</span>
              </button>
            );
          })}
        </div>
        {shown.length === 0
          ? <EmptyState icon={PhoneIphoneIcon} title={view === "to_match" ? "Nothing to match" : "No payments here"} subtitle={view === "to_match" ? "Every M-Pesa payment is on an invoice." : "M-Pesa payments appear here as they arrive."} />
          : shown.map((tx) => <TransactionRow key={tx.id} tx={tx} canQuery={Boolean(status?.canQuery)} />)}
      </section>

      {failed.length > 0 && (
        <section style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #EEF1F5" }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Prompts that didn't go through</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6B7280" }}>Someone tried to pay but the payment wasn't completed — worth a follow-up.</p>
          </div>
          {failed.slice(0, 50).map((r) => (
            <div key={r.id} style={{ padding: "11px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(160px, 1fr) minmax(160px, 1.4fr) auto", gap: 12, alignItems: "center", fontSize: 12.5 }}>
              <div>{r.invoiceNumber ? <Link to={`/billing/${r.invoiceId}`} style={{ color: "#25476a", fontWeight: 700, textDecoration: "none" }}>{r.invoiceNumber}</Link> : "—"}<div style={{ color: "#9CA3AF", fontSize: 11.5, marginTop: 2 }}>{formatDateTime(r.createdAt)} · {r.phone}</div></div>
              <div style={{ color: "#374151" }}><strong style={{ color: "#B45309" }}>{PROMPT_LOOK[r.status] || r.status}</strong> — {r.message}</div>
              <div style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(r.amount)}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
