import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCopy, FiDollarSign, FiGift, FiLink, FiMail, FiPlus, FiSettings, FiUsers, FiX } from "react-icons/fi";
import { Segmented, Tabs } from "../../../components/ui/TabBar";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading, pill } from "../../../theme/brand";
import { affiliatesApi, errorOf, formatDay, formatKsh, METHOD_LABEL, PROGRAMMES, RECURRING } from "../services/affiliatesApi";

// Affiliates (Finance, modules/affiliates/): people who send families to the website earn a share
// of what those families pay. Every active affiliate signs in: a parent or educator with their own
// login (Refer & earn in their portal), anyone else as Affiliate (the affiliate portal — a login made
// for them, its password set from the welcome email). Tabs: Affiliates (add, approve, suspend, codes
// and links, how they sign in) ·
// Referrals (each sign-up an affiliate brought in) · Commissions (one per paid invoice; waiting →
// available → paid) · Payouts (requests to pay: M-Pesa / bank / cash with a reference, or credit on
// one of the affiliate's invoices) · Settings (programmes, rates, periods, hold, minimum).

const TABS = [
  { key: "affiliates", label: "Affiliates", icon: FiUsers },
  { key: "referrals", label: "Referrals", icon: FiLink },
  { key: "commissions", label: "Commissions", icon: FiGift },
  { key: "payouts", label: "Payouts", icon: FiDollarSign },
  { key: "settings", label: "Settings", icon: FiSettings },
];
const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" };
const primary = { ...btn, background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" };
const input = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff" };
const label = { display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft };
const th = { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BRAND.border}`, whiteSpace: "nowrap" };
const td = { padding: "11px 12px", fontSize: 13, color: BRAND.inkSoft, borderBottom: `1px solid ${BRAND.line}`, verticalAlign: "top" };
const KIND = { parent: "Parent", educator: "Educator", other: "Affiliate" };
const SOURCE = { admin: "Added by staff", portal: "Joined from their portal", website: "Applied on the website" };
const STATUS_TONE = { active: "good", pending: "waiting", suspended: "neutral" };
const STATE = {
  waiting: ["Waiting", "neutral"], available: ["Available", "good"], requested: ["In a payout", "waiting"], paid: ["Paid", "strong"], cancelled: ["Cancelled", "danger"],
};
const PAYOUT_TONE = { requested: "waiting", paid: "strong", rejected: "danger" };

function Modal({ title, onClose, children }) {
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ ...card, width: "100%", maxHeight: "92vh", overflowY: "auto", padding: 22, fontFamily: FONT, boxShadow: "0 20px 50px rgba(15,23,42,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: BRAND.ink }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, padding: 6 }}><FiX size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Table({ head, children, empty }) {
  return (
    <div style={{ ...card, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT, minWidth: 720 }}>
        <thead><tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p style={{ margin: 0, padding: "28px 16px", textAlign: "center", color: BRAND.muted, fontSize: 13.5 }}>{empty}</p>}
    </div>
  );
}

const copy = (text, what = "Copied") => {
  navigator.clipboard?.writeText(text).then(() => toast.success(what)).catch(() => toast.error("Couldn't copy"));
};

// ---- Affiliates -----------------------------------------------------------------------------
function AffiliateDialog({ affiliate, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    name: affiliate?.name || "", email: affiliate?.email || "", phone: affiliate?.phone || "",
    code: affiliate?.code || "", status: affiliate?.status || "active", payoutMethod: affiliate?.payoutMethod || "credit",
    payoutPhone: affiliate?.payoutPhone || "", payoutDetails: affiliate?.payoutDetails || "", notes: affiliate?.notes || "",
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => (affiliate ? affiliatesApi.update(affiliate.id, form) : affiliatesApi.create({ ...form, code: form.code || undefined })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["affiliates"] }); toast.success(affiliate ? "Saved" : "Affiliate added"); onClose(); },
    onError: (err) => toast.error(errorOf(err)),
  });
  return (
    <Modal title={affiliate ? `Edit ${affiliate.name}` : "Add an affiliate"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: "grid", gap: 12 }}>
        <label style={label}>Name<input style={input} value={form.name} onChange={set("name")} required /></label>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <label style={label}>Email (they sign in with it)<input style={input} type="email" value={form.email} onChange={set("email")} required placeholder="name@example.com" /></label>
          <label style={label}>Phone<input style={input} value={form.phone} onChange={set("phone")} /></label>
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <label style={label}>Code<input style={{ ...input, textTransform: "uppercase" }} value={form.code} onChange={set("code")} placeholder={affiliate ? "" : "Made from their name"} /></label>
          <label style={label}>Status
            <select style={input} value={form.status} onChange={set("status")}>
              <option value="active">Active</option><option value="pending">Waiting for approval</option><option value="suspended">Suspended</option>
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <label style={label}>Paid by
            <select style={input} value={form.payoutMethod} onChange={set("payoutMethod")}>
              <option value="credit">Credit on their invoices</option><option value="mpesa">M-Pesa</option><option value="bank">Bank</option>
            </select>
          </label>
          {form.payoutMethod === "mpesa" && <label style={label}>M-Pesa number<input style={input} value={form.payoutPhone} onChange={set("payoutPhone")} /></label>}
          {form.payoutMethod === "bank" && <label style={label}>Bank details<input style={input} value={form.payoutDetails} onChange={set("payoutDetails")} placeholder="Bank, account name and number" /></label>}
        </div>
        {!affiliate && (
          <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted, lineHeight: 1.5 }}>
            A parent or educator signs in with the login they already have and finds Refer &amp; earn in their portal. Anyone else gets their own login: once they&rsquo;re active we email them a link to set their password, and they sign in as Affiliate.
          </p>
        )}
        {affiliate?.promotion && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>How they said they&rsquo;d share us: &ldquo;{affiliate.promotion}&rdquo;</p>}
        <label style={label}>Notes (only staff see these)<textarea style={{ ...input, minHeight: 64, resize: "vertical" }} value={form.notes} onChange={set("notes")} /></label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" style={btn} onClick={onClose}>Cancel</button>
          <button type="submit" style={primary} disabled={save.isPending}>{save.isPending ? "Saving…" : affiliate ? "Save" : "Add affiliate"}</button>
        </div>
      </form>
    </Modal>
  );
}

// How they sign in, under their name.
function AccountLine({ a }) {
  if (!a.account) {
    return <div style={{ fontSize: 12, color: BRAND.faint }}>{a.status === "pending" ? "Their login is set up once they're approved" : "No login yet — Email sign-in details sets it up"}</div>;
  }
  const where = a.account.asAffiliate ? "Signs in as Affiliate" : `Signs in as ${KIND[a.kind]} — Refer & earn in their portal`;
  const when = a.account.lastSignInAt ? `last signed in ${formatDay(a.account.lastSignInAt)}` : "hasn't signed in yet";
  return <div style={{ fontSize: 12, color: BRAND.faint }}>{where} · {when}</div>;
}

function AffiliatesTab({ onEdit }) {
  const qc = useQueryClient();
  const { data: affiliates = [], isLoading } = useQuery({ queryKey: ["affiliates", "list"], queryFn: affiliatesApi.list });
  const act = useMutation({
    mutationFn: ({ kind, a }) => (kind === "payout" ? affiliatesApi.createPayout(a.id)
      : kind === "delete" ? affiliatesApi.remove(a.id)
        : kind === "sign-in" ? affiliatesApi.sendSignInDetails(a.id)
          : affiliatesApi.update(a.id, { status: kind })),
    onSuccess: (res, { kind }) => {
      qc.invalidateQueries({ queryKey: ["affiliates"] });
      toast.success(kind === "payout" ? "Payout created — see Payouts" : kind === "delete" ? "Deleted" : kind === "sign-in" ? `Sign-in details emailed to ${res.email}` : "Saved");
    },
    onError: (err) => toast.error(errorOf(err)),
  });
  if (isLoading) return <p style={{ color: BRAND.muted }}>Loading…</p>;
  return (
    <>
    <Table head={["Affiliate", "Code & link", "Status", "Referrals", "Earned", "Available", ""]} empty={affiliates.length ? null : "No affiliates yet — add one, or let parents and educators join from their portal (Settings)."}>
      {affiliates.map((a) => (
        <tr key={a.id}>
          <td style={td}>
            <strong style={{ color: BRAND.ink }}>{a.name}</strong>
            <div style={{ fontSize: 12, color: BRAND.muted, overflowWrap: "anywhere" }}>{KIND[a.kind]}{a.email ? ` · ${a.email}` : ""}{a.phone ? ` · ${a.phone}` : ""}</div>
            <AccountLine a={a} />
            <div style={{ fontSize: 12, color: BRAND.faint }}>{SOURCE[a.source] || ""}{a.termsAcceptedAt ? ` · agreed to the terms ${formatDay(a.termsAcceptedAt)}` : ""}</div>
            {a.promotion && <div style={{ fontSize: 12, color: BRAND.inkSoft, marginTop: 4 }} title={a.promotion}>&ldquo;{a.promotion.length > 140 ? `${a.promotion.slice(0, 140)}…` : a.promotion}&rdquo;</div>}
          </td>
          <td style={td}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ fontWeight: 800, color: BRAND.navy }}>{a.code}</code>
              <button type="button" style={{ ...btn, padding: "4px 8px" }} onClick={() => copy(a.code, "Code copied")} title="Copy code"><FiCopy size={12} /></button>
              {a.link && <button type="button" style={{ ...btn, padding: "4px 8px" }} onClick={() => copy(a.link, "Link copied")} title={a.link}><FiLink size={12} /> Link</button>}
            </div>
          </td>
          <td style={td}><span style={pill(STATUS_TONE[a.status])}>{a.status === "pending" ? "To approve" : a.status === "active" ? "Active" : "Suspended"}</span></td>
          <td style={td}>{a.paidReferrals} paid / {a.referrals}</td>
          <td style={td}>{formatKsh(a.totals.earned)}<div style={{ fontSize: 12, color: BRAND.muted }}>{formatKsh(a.totals.paid)} paid out</div></td>
          <td style={td}>{formatKsh(a.totals.available)}{a.totals.waiting > 0 && <div style={{ fontSize: 12, color: BRAND.muted }}>+ {formatKsh(a.totals.waiting)} waiting</div>}</td>
          <td style={{ ...td, textAlign: "right" }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {a.status === "pending" && <button type="button" style={primary} onClick={() => act.mutate({ kind: "active", a })}>Approve</button>}
              {a.status === "active" && a.totals.available > 0 && <button type="button" style={btn} onClick={() => act.mutate({ kind: "payout", a })}>Pay out {formatKsh(a.totals.available)}</button>}
              {a.status !== "pending" && (!a.account || a.account.asAffiliate) && (
                <button type="button" style={btn} disabled={act.isPending}
                  title="Emails them how to sign in, with a link to set (or reset) their password — the link goes only to their email"
                  onClick={() => window.confirm(`Email ${a.name} how to sign in, with a link to set their password?`) && act.mutate({ kind: "sign-in", a })}>
                  <FiMail size={12} /> Email sign-in details
                </button>
              )}
              <button type="button" style={btn} onClick={() => onEdit(a)}>Edit</button>
              {a.status === "active" && <button type="button" style={btn} onClick={() => act.mutate({ kind: "suspended", a })}>Suspend</button>}
              {a.status === "suspended" && <button type="button" style={btn} onClick={() => act.mutate({ kind: "active", a })}>Reactivate</button>}
              {a.referrals === 0 && <button type="button" style={{ ...btn, color: BRAND.danger }} onClick={() => window.confirm(`Delete ${a.name}?`) && act.mutate({ kind: "delete", a })}>Delete</button>}
            </div>
          </td>
        </tr>
      ))}
    </Table>
    </>
  );
}

// ---- Referrals --------------------------------------------------------------------------------
function ReferralsTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["affiliates", "referrals"], queryFn: () => affiliatesApi.referrals() });
  const cancel = useMutation({
    mutationFn: (r) => affiliatesApi.cancelReferral(r.id, window.prompt("Why? (optional)") || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["affiliates"] }); toast.success("Referral cancelled"); },
    onError: (err) => toast.error(errorOf(err)),
  });
  if (isLoading) return <p style={{ color: BRAND.muted }}>Loading…</p>;
  return (
    <Table head={["Signed up", "Family", "Programme", "Affiliate", "How", "Status", "Earned", ""]} empty={rows.length ? null : "No referrals yet. They appear here as families sign up on the website with an affiliate's link or code."}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td style={td}>{formatDay(r.createdAt)}</td>
          <td style={td}><strong style={{ color: BRAND.ink }}>{r.customerName || "—"}</strong><div style={{ fontSize: 12, color: BRAND.muted, overflowWrap: "anywhere" }}>{[r.parentEmail, r.parentPhone].filter(Boolean).join(" · ")}</div></td>
          <td style={td}>{r.programmeLabel}<div style={{ fontSize: 12, color: BRAND.muted }}>{r.detail}</div></td>
          <td style={td}>{r.affiliate ? <>{r.affiliate.name} <code style={{ color: BRAND.navy }}>{r.affiliate.code}</code></> : "—"}</td>
          <td style={td}>{r.via === "code" ? "Typed the code" : "Came by the link"}{r.landingPage && <div style={{ fontSize: 12, color: BRAND.muted }}>{r.landingPage}</div>}</td>
          <td style={td}><span style={pill(r.status === "paid" ? "good" : r.status === "cancelled" ? "danger" : "waiting")}>{r.status === "paid" ? "Paying" : r.status === "cancelled" ? "Cancelled" : "Not paid yet"}</span></td>
          <td style={td}>{formatKsh(r.earned)}{r.payments > 0 && <div style={{ fontSize: 12, color: BRAND.muted }}>{r.payments} {r.payments === 1 ? "payment" : "payments"}</div>}</td>
          <td style={{ ...td, textAlign: "right" }}>{r.status !== "cancelled" && <button type="button" style={btn} onClick={() => window.confirm("Cancel this referral? It stops earning, and commissions not yet paid out are cancelled.") && cancel.mutate(r)}>Cancel</button>}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---- Commissions ------------------------------------------------------------------------------
function CommissionsTab() {
  const qc = useQueryClient();
  const [state, setState] = useState("");
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["affiliates", "commissions"], queryFn: () => affiliatesApi.commissions() });
  const cancel = useMutation({
    mutationFn: (c) => affiliatesApi.cancelCommission(c.id, window.prompt("Why? (optional)") || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["affiliates"] }); toast.success("Commission cancelled"); },
    onError: (err) => toast.error(errorOf(err)),
  });
  const shown = state ? rows.filter((c) => c.state === state) : rows;
  const count = (k) => rows.filter((c) => c.state === k).length;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Segmented label="Commission state" value={state} onChange={setState}
        options={[{ key: "", label: "All" }, ...["waiting", "available", "requested", "paid", "cancelled"].map((k) => ({ key: k, label: STATE[k][0], count: count(k) }))]} />
      {isLoading ? <p style={{ color: BRAND.muted }}>Loading…</p> : (
        <Table head={["Paid", "Affiliate", "Family", "Invoice", "Payment", "Commission", "State", ""]} empty={shown.length ? null : "Nothing here."}>
          {shown.map((c) => (
            <tr key={c.id}>
              <td style={td}>{formatDay(c.createdAt)}</td>
              <td style={td}>{c.affiliate?.name || "—"}</td>
              <td style={td}>{c.customerName || "—"}<div style={{ fontSize: 12, color: BRAND.muted }}>{c.programmeLabel}</div></td>
              <td style={td}>{c.invoiceNumber || "—"}{RECURRING.has(c.programme) && <div style={{ fontSize: 12, color: BRAND.muted }}>Payment {c.periodNumber}</div>}</td>
              <td style={td}>{formatKsh(c.baseAmount)} × {c.ratePercent}%</td>
              <td style={td}><strong style={{ color: BRAND.ink }}>{formatKsh(c.amount)}</strong></td>
              <td style={td}><span style={pill(STATE[c.state][1])}>{STATE[c.state][0]}</span>{c.state === "waiting" && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 3 }}>from {formatDay(c.availableAt)}</div>}{c.note && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 3 }}>{c.note}</div>}</td>
              <td style={{ ...td, textAlign: "right" }}>{["waiting", "available"].includes(c.state) && <button type="button" style={btn} onClick={() => window.confirm("Cancel this commission?") && cancel.mutate(c)}>Cancel</button>}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ---- Payouts ----------------------------------------------------------------------------------
function PayDialog({ payout, onClose }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState(payout.method);
  const [reference, setReference] = useState("");
  const [creditInvoiceId, setCreditInvoiceId] = useState("");
  const { data: invoices = [] } = useQuery({ queryKey: ["affiliates", "open-invoices", payout.affiliateId], queryFn: () => affiliatesApi.openInvoices(payout.affiliateId), enabled: method === "credit" });
  const pay = useMutation({
    mutationFn: () => affiliatesApi.markPaid(payout.id, { method, reference: reference || null, creditInvoiceId: creditInvoiceId || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["affiliates"] }); toast.success("Payout recorded"); onClose(); },
    onError: (err) => toast.error(errorOf(err)),
  });
  const a = payout.affiliate || {};
  return (
    <Modal title={`Pay ${a.name || "the affiliate"} ${formatKsh(payout.amount)}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); pay.mutate(); }} style={{ display: "grid", gap: 12 }}>
        <label style={label}>How it's paid
          <select style={input} value={method} onChange={(e) => setMethod(e.target.value)}>
            {a.userId && <option value="credit">Credit on one of their invoices</option>}
            <option value="mpesa">M-Pesa</option><option value="bank">Bank transfer</option><option value="cash">Cash</option>
          </select>
        </label>
        {method === "mpesa" && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>Send to {a.payoutPhone || "their number (not given — ask them)"}, then type the M-Pesa code.</p>}
        {method === "bank" && a.payoutDetails && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>{a.payoutDetails}</p>}
        {method === "credit" ? (
          <label style={label}>Invoice
            <select style={input} value={creditInvoiceId} onChange={(e) => setCreditInvoiceId(e.target.value)} required>
              <option value="">{invoices.length ? "Choose an unpaid invoice…" : "They have no unpaid invoice"}</option>
              {invoices.map((i) => <option key={i.id} value={i.id} disabled={i.amountDue < payout.amount}>{i.invoiceNumber} — {formatKsh(i.amountDue)} due{i.periodLabel ? ` · ${i.periodLabel}` : ""}{i.amountDue < payout.amount ? " (too small)" : ""}</option>)}
            </select>
          </label>
        ) : method !== "cash" && (
          <label style={label}>{method === "mpesa" ? "M-Pesa code" : "Bank reference"}<input style={input} value={reference} onChange={(e) => setReference(e.target.value)} required /></label>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" style={btn} onClick={onClose}>Cancel</button>
          <button type="submit" style={primary} disabled={pay.isPending}>{pay.isPending ? "Saving…" : "Mark paid"}</button>
        </div>
      </form>
    </Modal>
  );
}

function PayoutsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("requested");
  const [paying, setPaying] = useState(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["affiliates", "payouts"], queryFn: () => affiliatesApi.payouts() });
  const reject = useMutation({
    mutationFn: (p) => affiliatesApi.reject(p.id, window.prompt("Why? (the affiliate sees this)") || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["affiliates"] }); toast.success("Rejected — its commissions are available again"); },
    onError: (err) => toast.error(errorOf(err)),
  });
  const shown = status ? rows.filter((p) => p.status === status) : rows;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Segmented label="Payout status" value={status} onChange={setStatus}
        options={[{ key: "requested", label: "To pay", count: rows.filter((p) => p.status === "requested").length }, { key: "paid", label: "Paid" }, { key: "rejected", label: "Rejected" }, { key: "", label: "All" }]} />
      {isLoading ? <p style={{ color: BRAND.muted }}>Loading…</p> : (
        <Table head={["Asked", "Affiliate", "Amount", "How", "Status", ""]} empty={shown.length ? null : "Nothing here."}>
          {shown.map((p) => (
            <tr key={p.id}>
              <td style={td}>{formatDay(p.createdAt)}</td>
              <td style={td}><strong style={{ color: BRAND.ink }}>{p.affiliate?.name || "—"}</strong> <code style={{ color: BRAND.navy }}>{p.affiliate?.code}</code></td>
              <td style={td}><strong style={{ color: BRAND.ink }}>{formatKsh(p.amount)}</strong></td>
              <td style={td}>{METHOD_LABEL[p.method]}{p.status === "requested" && p.method === "mpesa" && p.affiliate?.payoutPhone && <div style={{ fontSize: 12, color: BRAND.muted }}>{p.affiliate.payoutPhone}</div>}{p.reference && <div style={{ fontSize: 12, color: BRAND.muted }}>{p.creditInvoiceNumber ? `On ${p.creditInvoiceNumber}` : p.reference}</div>}</td>
              <td style={td}><span style={pill(PAYOUT_TONE[p.status])}>{p.status === "requested" ? "To pay" : p.status === "paid" ? `Paid ${formatDay(p.decidedAt)}` : "Rejected"}</span>{p.note && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 3 }}>{p.note}</div>}</td>
              <td style={{ ...td, textAlign: "right" }}>
                {p.status === "requested" && (
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" style={primary} onClick={() => setPaying(p)}>Mark paid</button>
                    <button type="button" style={btn} onClick={() => reject.mutate(p)}>Reject</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {paying && <PayDialog payout={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

// ---- Settings ---------------------------------------------------------------------------------
function SettingsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["affiliates", "settings"], queryFn: affiliatesApi.settings });
  const [form, setForm] = useState(null);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const save = useMutation({
    mutationFn: () => affiliatesApi.saveSettings(form),
    onSuccess: (saved) => { qc.setQueryData(["affiliates", "settings"], saved); toast.success("Settings saved"); },
    onError: (err) => toast.error(errorOf(err)),
  });
  if (!form) return <p style={{ color: BRAND.muted }}>Loading…</p>;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (k) => ({ type: "number", value: form[k], onChange: (e) => set(k, e.target.value === "" ? "" : Number(e.target.value)), style: input });
  const check = (k, text) => (
    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: BRAND.inkSoft, cursor: "pointer" }}>
      <input type="checkbox" checked={Boolean(form[k])} onChange={(e) => set(k, e.target.checked)} style={{ flexShrink: 0 }} /> {text}
    </label>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: "grid", gap: 14, width: "100%" }}>
      <section style={{ ...card, padding: 18, display: "grid", gap: 12 }}>
        <h3 style={cardHeading}>The programme</h3>
        {check("enabled", "Referrals earn commission")}
        {check("selfJoin", "Parents and educators can join from their portal (Refer & earn)")}
        {check("publicApplications", "Anyone can apply on the website (Become an affiliate) — they get their own login once active")}
        {(form.selfJoin || form.publicApplications) && check("requireApproval", "An admin approves each one first")}
        {check("emailOutsiders", "Email affiliates who sign in as Affiliate when a family signs up, they earn or a payout is decided (they also get the bell; parents and educators get the bell only)")}
      </section>
      <section style={{ ...card, padding: 18, display: "grid", gap: 10 }}>
        <h3 style={cardHeading}>What earns, and how much</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>A share of what the referred family pays — only once an invoice is paid in full.</p>
        {/* One box per programme, the boxes sharing the full width. */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))" }}>
          {PROGRAMMES.map(([key, name]) => (
            <div key={key} style={{ display: "grid", gap: 8, padding: 12, borderRadius: 10, border: `1px solid ${BRAND.line}`, background: form.programmes[key] ? "#fff" : "#F8FAFC" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, fontWeight: 700, color: BRAND.inkSoft, cursor: "pointer" }}>
                <input type="checkbox" checked={form.programmes[key]} onChange={(e) => set("programmes", { ...form.programmes, [key]: e.target.checked })} style={{ flexShrink: 0 }} /> {name}
              </label>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: BRAND.muted }}>
                <input type="number" min={0} max={100} step="0.5" value={form.rates[key]} disabled={!form.programmes[key]}
                  onChange={(e) => set("rates", { ...form.rates, [key]: e.target.value === "" ? "" : Number(e.target.value) })} style={{ ...input, flex: 1, minWidth: 0 }} /> %
              </span>
              <span style={{ fontSize: 12, color: BRAND.muted }}>{RECURRING.has(key) ? "of each paid period" : "of the payment"}</span>
            </div>
          ))}
        </div>
      </section>
      <section style={{ ...card, padding: 18, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <label style={label}>Paid periods that earn (subscriptions)<input min={1} max={60} {...num("periods")} /></label>
        <label style={label}>Days a commission waits before payout<input min={0} max={180} {...num("holdDays")} /></label>
        <label style={label}>Smallest payout (KSh)<input min={0} {...num("minimumPayout")} /></label>
        <label style={label}>Days a link counts after the visit<input min={1} max={365} {...num("attributionDays")} /></label>
      </section>
      <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>
        Website sign-ups belong to the website's workspace, so only its affiliates earn from them. A family never earns from their own sign-up.
      </p>
      <div><button type="submit" style={primary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</button></div>
    </form>
  );
}

export default function AffiliatesPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "affiliates";
  const [editing, setEditing] = useState(null); // null | "new" | affiliate
  const { data: affiliates = [] } = useQuery({ queryKey: ["affiliates", "list"], queryFn: affiliatesApi.list });
  const { data: payouts = [] } = useQuery({ queryKey: ["affiliates", "payouts"], queryFn: () => affiliatesApi.payouts() });
  const toApprove = affiliates.filter((a) => a.status === "pending").length;
  const toPay = payouts.filter((p) => p.status === "requested").length;
  const earned = affiliates.reduce((s, a) => s + a.totals.earned, 0);
  const referred = affiliates.reduce((s, a) => s + a.paidReferrals, 0);

  return (
    <div style={{ fontFamily: FONT, display: "grid", gap: 16 }}>
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "26px 30px", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff" }}>Affiliates</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
            People who send families to the website earn a share of what those families pay. A link (?ref=CODE) or a code typed at sign-up credits them; only paid invoices earn.
          </p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12, color: "#fff", fontSize: 13 }}>
            <span><strong>{affiliates.length}</strong> {affiliates.length === 1 ? "affiliate" : "affiliates"}</span>
            <span><strong>{referred}</strong> paying {referred === 1 ? "family" : "families"}</span>
            <span><strong>{formatKsh(earned)}</strong> earned</span>
          </div>
        </div>
        <button type="button" onClick={() => setEditing("new")} style={{ ...btn, padding: "11px 18px", fontSize: 14, background: "rgba(255,255,255,0.14)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
          <FiPlus size={15} /> Add affiliate
        </button>
      </div>

      <Tabs label="Affiliates" value={tab} onChange={(key) => setParams({ tab: key }, { replace: true })}
        tabs={TABS.map((t) => ({ ...t, count: t.key === "affiliates" && toApprove ? toApprove : t.key === "payouts" && toPay ? toPay : null, alert: (t.key === "affiliates" && toApprove > 0) || (t.key === "payouts" && toPay > 0) }))} />

      {tab === "affiliates" && <AffiliatesTab onEdit={setEditing} />}
      {tab === "referrals" && <ReferralsTab />}
      {tab === "commissions" && <CommissionsTab />}
      {tab === "payouts" && <PayoutsTab />}
      {tab === "settings" && <SettingsTab />}

      {editing && <AffiliateDialog affiliate={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
