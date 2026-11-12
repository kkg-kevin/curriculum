import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiFileText, FiLock, FiPause, FiPlay, FiRepeat, FiUnlock, FiUsers, FiXCircle } from "react-icons/fi";
import { pathwaySubscriptionApi } from "../services/pathwaySubscriptionApi";
import { formatDay, formatKsh, outlookLine, pricePer } from "../../../utils/billingPeriods";
import { periodLabel, pricesOf } from "../../home-learning/services/homeLearningApi";
import { HistoryButton } from "../../activity/components/RecordStamp";

import { askConfirm } from "../../../components/ui/AskDialog";
// Pathway subscriptions (modules/pathway-subscriptions): the families paying for a website pathway
// by the week, month, quarter or year. Each card: the family, the pathway and plan, the children
// on it, whether their courses are open and until when, what's owed and the next invoice.
// Pause / cancel / switch back on, change plan (from the next period), invoice the next period now.
// Plans are made in Billing → Packages → Pathways.

const font = "Inter, sans-serif";
const card = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, boxShadow: "0 1px 4px rgba(15,23,42,0.04)" };
const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", color: "#374151", fontSize: 12.5, fontWeight: 700, fontFamily: font, cursor: "pointer" };
const STATUS = {
  pending: { label: "Awaiting first payment", bg: "#FFFBEB", color: "#B45309" },
  active: { label: "Active", bg: "#ECFDF5", color: "#047857" },
  paused: { label: "Paused", bg: "#F3F4F6", color: "#4B5563" },
  cancelled: { label: "Cancelled", bg: "#FEF2F2", color: "#B91C1C" },
};
const FILTERS = [["", "All"], ["active", "Active"], ["pending", "Awaiting payment"], ["paused", "Paused"], ["cancelled", "Cancelled"]];
const errorOf = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

function Pill({ look }) {
  return <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 999, background: look.bg, color: look.color, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{look.label}</span>;
}

function SubscriptionCard({ sub, plans, focused, onAction, busy }) {
  const ref = useRef(null);
  useEffect(() => { if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [focused]);
  const [planId, setPlanId] = useState("");
  const look = STATUS[sub.status] || STATUS.pending;
  // Every plan of the pathway at each of its periods — another plan, or the same plan on another period.
  const otherPlans = plans
    .filter((p) => p.pathwayTemplateId === sub.pathwayTemplateId && (p.status === "active" || p.id === sub.packageId))
    .flatMap((p) => pricesOf(p).filter((x) => x.billingPeriod !== "daily").map((x) => ({ plan: p, ...x, key: `${p.id}|${x.billingPeriod}` })))
    .filter((o) => !(o.plan.id === sub.packageId && o.billingPeriod === sub.billingPeriod));
  const outlook = outlookLine(sub.outlook);

  return (
    <div ref={ref} style={{ ...card, padding: "16px 18px", display: "grid", gap: 10, gridTemplateColumns: "100%", outline: focused ? "2px solid #38aae1" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15, color: "#111827" }}>{sub.guardianName}</strong>
            <HistoryButton type="pathway_subscriptions" id={sub.id} label={`${sub.guardianName} · ${sub.pathwayName}`} iconOnly />
            <Pill look={look} />
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6B7280", overflowWrap: "anywhere" }}>{[sub.guardianEmail, sub.guardianPhone].filter(Boolean).join(" · ")}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#25476a" }}>{pricePer(sub.amount, sub.billingPeriod)}</div>
          {sub.outstanding > 0 && <div style={{ fontSize: 12, color: "#C2410C", marginTop: 2 }}>{formatKsh(sub.outstanding)} owed</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px 16px", flexWrap: "wrap", fontSize: 13, color: "#374151" }}>
        <span><strong>{sub.pathwayName}</strong>{sub.planName ? ` · ${sub.planName}` : ""}</span>
        {sub.hubName && <span style={{ color: "#6B7280" }}>{sub.hubName}</span>}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: sub.accessOpen ? "#047857" : "#B45309", fontWeight: 700 }}>
          {sub.accessOpen ? <FiUnlock size={13} /> : <FiLock size={13} />}
          {sub.accessOpen ? `Courses open until ${formatDay(sub.accessUntil)}` : sub.status === "pending" ? "Courses open once paid" : "Courses locked"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <FiUsers size={13} color="#6B7280" />
        {sub.children.map((c) => (
          <Link key={c.learnerId} to={`/learners/${c.learnerId}`} style={{ padding: "3px 10px", borderRadius: 999, background: "#F3F7FB", color: "#25476a", fontSize: 12, fontWeight: 700, textDecoration: "none", opacity: c.status === "active" ? 1 : 0.6 }}>
            {c.name}{c.username ? ` (${c.username})` : ""}
          </Link>
        ))}
      </div>

      {outlook && <p style={{ margin: 0, fontSize: 12.5, color: "#6B7280" }}>{outlook}</p>}

      {sub.invoices.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {sub.invoices.map((inv) => (
            <Link key={inv.id} to={`/billing/${inv.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 11.5, color: "#374151", textDecoration: "none" }}>
              <FiFileText size={11} /> {inv.invoiceNumber} · {inv.status.replace("_", " ")}
            </Link>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid #F3F4F6" }}>
        {sub.status === "active" && <button type="button" style={btn} disabled={busy} onClick={() => onAction("invoice", sub)}><FiFileText size={13} /> Invoice next period now</button>}
        {sub.status === "active" && <button type="button" style={btn} disabled={busy} onClick={() => onAction("paused", sub)}><FiPause size={13} /> Pause</button>}
        {["paused", "cancelled"].includes(sub.status) && <button type="button" style={{ ...btn, borderColor: "#25476a", color: "#25476a" }} disabled={busy} onClick={() => onAction("active", sub)}><FiPlay size={13} /> Switch back on</button>}
        {sub.status !== "cancelled" && <button type="button" style={{ ...btn, color: "#B91C1C" }} disabled={busy} onClick={() => onAction("cancelled", sub)}><FiXCircle size={13} /> Cancel</button>}
        {sub.status === "active" && otherPlans.length > 0 && (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", flex: "0 1 auto", minWidth: 0, maxWidth: "100%" }}>
            {/* A long plan name mustn't widen the row past a phone's edge: the dropdown shrinks to fit. */}
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={{ ...btn, fontWeight: 600, paddingRight: 8, flex: "0 1 260px", width: 260, minWidth: 0, maxWidth: "100%", textOverflow: "ellipsis" }} aria-label="Change plan">
              <option value="">Change plan…</option>
              {otherPlans.map((o) => <option key={o.key} value={o.key}>{o.plan.name} — {periodLabel(o.billingPeriod)} · {pricePer(o.amount, o.billingPeriod)}</option>)}
            </select>
            {planId && <button type="button" style={btn} disabled={busy} onClick={() => { const [packageId, billingPeriod] = planId.split("|"); onAction("plan", sub, { packageId, billingPeriod }); setPlanId(""); }}><FiRepeat size={13} /> From next period</button>}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PathwaySubscriptionsPage() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const focusId = params.get("subscription");
  const [status, setStatus] = useState("");
  const [pathway, setPathway] = useState("");
  const { data: rows, isLoading } = useQuery({ queryKey: ["pathway-subscriptions", "list"], queryFn: () => pathwaySubscriptionApi.list() });
  const { data: planRows } = useQuery({ queryKey: ["billing", "pathway-packages"], queryFn: () => pathwaySubscriptionApi.listPackages() });
  const subs = Array.isArray(rows) ? rows : [];
  const plans = Array.isArray(planRows) ? planRows : [];
  const pathways = useMemo(() => [...new Set(subs.map((s) => s.pathwayName))].sort(), [subs]);
  const shown = subs.filter((s) => (!status || s.status === status) && (!pathway || s.pathwayName === pathway));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pathway-subscriptions"] });

  const action = useMutation({
    mutationFn: ({ kind, sub, extra }) => {
      if (kind === "invoice") return pathwaySubscriptionApi.invoiceNext(sub.id);
      if (kind === "plan") return pathwaySubscriptionApi.changePlan(sub.id, extra);
      return pathwaySubscriptionApi.setStatus(sub.id, kind);
    },
    onSuccess: (result, { kind }) => {
      refresh();
      toast.success({
        invoice: result?.created === false ? "That period is already invoiced" : "Invoice raised and emailed",
        plan: "Plan changes from the next period",
        paused: "Paused — courses locked, billing stopped",
        cancelled: "Subscription cancelled",
        active: "Switched back on — a new period's invoice is out if one was due",
      }[kind]);
    },
    onError: (err) => toast.error(errorOf(err, "Couldn't do that")),
  });
  const due = useMutation({
    mutationFn: pathwaySubscriptionApi.invoiceDue,
    onSuccess: (counts) => { refresh(); toast.success(counts?.invoices ? `${counts.invoices} invoice${counts.invoices === 1 ? "" : "s"} raised` : "Nothing is due yet"); },
    onError: (err) => toast.error(errorOf(err, "Couldn't raise invoices")),
  });
  const onAction = async (kind, sub, extra) => {
    if (kind === "cancelled" && !(await askConfirm({ title: `Cancel ${sub.guardianName}'s ${sub.pathwayName} subscription?`, message: "Their courses lock now and unpaid invoices are cancelled. Progress is kept.", confirmLabel: "Cancel subscription", cancelLabel: "Keep it", tone: "danger" }))) return;
    if (kind === "paused" && !(await askConfirm({ title: `Pause ${sub.guardianName}'s ${sub.pathwayName} subscription?`, message: "Their courses lock now and billing stops until you switch it back on.", confirmLabel: "Pause" }))) return;
    action.mutate({ kind, sub, extra });
  };

  return (
    <div style={{ width: "100%", fontFamily: font, display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
      <section style={{ ...card, padding: "20px 22px", background: "linear-gradient(135deg,#17304B,#25476a)", color: "#fff", border: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0, maxWidth: 680 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Pathway subscriptions</h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.8)", lineHeight: 1.6 }}>
              Families paying for a website pathway every period. Paying opens every stage's courses — self-paced, no class needed; an unpaid period locks them after the grace days, keeping progress, until the family renews.
              Plans are in <Link to="/billing?tab=packages" style={{ color: "#9BD7F2", fontWeight: 700 }}>Billing → Packages</Link>.
            </p>
          </div>
          <button type="button" disabled={due.isPending} onClick={() => due.mutate()} style={{ ...btn, background: "#feb139", border: 0, color: "#17304B" }}><FiFileText size={13} /> {due.isPending ? "Invoicing…" : "Invoice what's due now"}</button>
        </div>
      </section>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#EEF2F6", borderRadius: 10, flexWrap: "wrap" }}>
          {FILTERS.map(([key, label]) => (
            <button key={key || "all"} type="button" onClick={() => setStatus(key)} style={{ border: 0, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, fontFamily: font, cursor: "pointer", background: status === key ? "#fff" : "transparent", color: status === key ? "#111827" : "#6B7280" }}>
              {label} <span style={{ color: "#9CA3AF" }}>{key ? subs.filter((s) => s.status === key).length : subs.length}</span>
            </button>
          ))}
        </div>
        {pathways.length > 1 && (
          <select value={pathway} onChange={(e) => setPathway(e.target.value)} style={{ ...btn, fontWeight: 600 }} aria-label="Filter by pathway">
            <option value="">Every pathway</option>
            {pathways.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {isLoading ? <p style={{ color: "#6B7280", fontSize: 13 }}>Loading…</p>
        : shown.length === 0
          ? <section style={{ ...card, padding: "28px 20px", textAlign: "center", color: "#6B7280", fontSize: 13 }}>
              {subs.length === 0 ? "No pathway subscriptions yet. Create a plan in Billing → Packages → Pathways and tick “Show on the website” — families subscribe from the pathway's page." : "No subscriptions match."}
            </section>
          : shown.map((sub) => <SubscriptionCard key={sub.id} sub={sub} plans={plans} focused={sub.id === focusId} onAction={onAction} busy={action.isPending} />)}
    </div>
  );
}
