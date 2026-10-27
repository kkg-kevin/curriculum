import { useEffect, useState } from "react";
import { Toggle } from "../../../components/ui/EmailNotificationSettings";
import { usePaymentOptions, useSavePaymentOptions } from "./paymentSettingsApi";
import { SettingsSection, Field, FooterNote, LoadState } from "../components/SettingsLayout";

// Settings → Payments → Part payments (server: payments/payment-options.js's partPayments,
// billing/billing.instalments.js). Any invoice can be paid in parts; this decides:
//   - what switches a website sign-up's accounts on (any payment, or a share of the invoice);
//   - the plans a family can choose when paying a sign-up online (staff can set any schedule on
//     any invoice, from its page);
//   - reminders before a payment is due, and what happens when one is late — after the grace days
//     the family's learner accounts pause until it's paid (hubs are reminded, never paused).

const DEFAULTS = {
  enabled: true, minimumPercent: 0, plans: [], planTypes: ["home_learning", "tech_club", "bootcamp"],
  remindDaysBefore: 3, graceDays: 7, pauseAccess: true,
};
const PLAN_TYPES = [
  ["home_learning", "Home Learning sign-ups"],
  ["tech_club", "Tech Club sign-ups"],
  ["bootcamp", "Bootcamp sign-ups"],
];
const keyFrom = (label, taken) => {
  const base = String(label || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "plan";
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) key = `${base}_${n}`;
  return key;
};

function Row({ title, description, children }) {
  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "#111827" }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280", lineHeight: 1.45 }}>{description}</p>
      </div>
      <div style={{ flex: "0 1 auto" }}>{children}</div>
    </div>
  );
}

const number = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export default function PartPaymentsSection() {
  const { data, isLoading, isError } = usePaymentOptions();
  const { mutate: save, isPending: saving } = useSavePaymentOptions();
  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    if (data?.options) setForm({ ...DEFAULTS, ...(data.options.partPayments || {}) });
  }, [data]);

  if (isLoading || isError || !data) return <LoadState isLoading={isLoading} isError={isError || (!isLoading && !data)} what="Part payments" />;

  const saved = { ...DEFAULTS, ...(data.options.partPayments || {}) };
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setPlan = (i, key) => (e) => setForm((f) => ({ ...f, plans: f.plans.map((p, j) => (j === i ? { ...p, [key]: key === "label" ? e.target.value : e.target.value === "" ? null : Number(e.target.value) } : p)) }));
  const addPlan = () => setForm((f) => {
    const label = `${f.plans.length + 2} monthly payments`;
    return { ...f, plans: [...f.plans, { key: keyFrom(label, f.plans.map((p) => p.key)), label, count: f.plans.length + 2, intervalMonths: 1, depositPercent: null }] };
  });
  const togglePlanType = (type) => setForm((f) => ({ ...f, planTypes: f.planTypes.includes(type) ? f.planTypes.filter((t) => t !== type) : [...f.planTypes, type] }));
  const submit = (e) => {
    e.preventDefault();
    const partPayments = {
      ...form,
      minimumPercent: number(form.minimumPercent, 0, 100),
      remindDaysBefore: number(form.remindDaysBefore, 0, 30),
      graceDays: number(form.graceDays, 0, 90),
      plans: form.plans.map((p) => ({ ...p, label: p.label.trim() || "Payment plan", count: number(p.count, 2, 12), intervalMonths: number(p.intervalMonths, 1, 12), depositPercent: p.depositPercent ? number(p.depositPercent, 1, 99) : null })),
    };
    save({ ...data.options, partPayments });
  };

  return (
    <SettingsSection
      as="form"
      onSubmit={submit}
      title="Part payments"
      description="Families and hubs can pay any invoice in parts. Set the plans families can choose, what a part payment switches on, and what happens when a payment is late."
      footer={(
        <>
          <button type="submit" className="stg-btn-primary" disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</button>
          <FooterNote>Staff can split any invoice into payments from the invoice's page.</FooterNote>
        </>
      )}
    >
      <div>
        <Row title="Switching a sign-up on" description="A website sign-up's accounts switch on once this share of its invoice is paid. 0% means any payment.">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input className="stg-input" type="number" min="0" max="100" step="1" value={form.minimumPercent} onChange={(e) => set("minimumPercent")(e.target.value)} aria-label="Share that switches a sign-up on (%)" style={{ width: 80 }} /> %
          </span>
        </Row>

        <Row title="Let families choose a plan" description="When paying a sign-up online, families can pay in full or pick one of the plans below.">
          <Toggle checked={form.enabled} onChange={set("enabled")} label="Let families choose a plan" />
        </Row>

        {form.enabled && (
          <div style={{ padding: "14px 0", borderBottom: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#111827" }}>Plans</p>
            {form.plans.length === 0 && <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>No plans yet — families pay in full.</p>}
            {form.plans.map((p, i) => (
              <div key={p.key} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 2fr) repeat(3, minmax(90px, 1fr)) auto", gap: 8, alignItems: "end" }}>
                <Field label="Plan name" htmlFor={`pp-label-${i}`}><input id={`pp-label-${i}`} className="stg-input" value={p.label} maxLength={80} onChange={setPlan(i, "label")} /></Field>
                <Field label="Payments" htmlFor={`pp-count-${i}`}><input id={`pp-count-${i}`} className="stg-input" type="number" min="2" max="12" value={p.count} onChange={setPlan(i, "count")} /></Field>
                <Field label="Months apart" htmlFor={`pp-gap-${i}`}><input id={`pp-gap-${i}`} className="stg-input" type="number" min="1" max="12" value={p.intervalMonths} onChange={setPlan(i, "intervalMonths")} /></Field>
                <Field label="First payment %" htmlFor={`pp-dep-${i}`} note={p.depositPercent ? null : "Equal parts"}><input id={`pp-dep-${i}`} className="stg-input" type="number" min="1" max="99" value={p.depositPercent ?? ""} placeholder="—" onChange={setPlan(i, "depositPercent")} /></Field>
                <button type="button" onClick={() => setForm((f) => ({ ...f, plans: f.plans.filter((_, j) => j !== i) }))} className="stg-btn-secondary" aria-label={`Remove ${p.label}`} style={{ marginBottom: 2 }}>Remove</button>
              </div>
            ))}
            {form.plans.length < 6 && <button type="button" onClick={addPlan} className="stg-btn-secondary" style={{ alignSelf: "flex-start" }}>+ Add a plan</button>}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
              {PLAN_TYPES.map(([type, label]) => (
                <label key={type} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#374151" }}>
                  <input type="checkbox" checked={form.planTypes.includes(type)} onChange={() => togglePlanType(type)} /> {label}
                </label>
              ))}
            </div>
          </div>
        )}

        <Row title="Reminders" description="Payers are reminded this many days before a payment is due, on the day, the day after, and when the grace days run out. Switch reminder emails off in Settings → Emails.">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input className="stg-input" type="number" min="0" max="30" value={form.remindDaysBefore} onChange={(e) => set("remindDaysBefore")(e.target.value)} aria-label="Days before" style={{ width: 70 }} /> days before
          </span>
        </Row>

        <Row title="Grace days" description="How long a payment can be late before the last reminder — and, if pausing is on, before a family's access pauses.">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input className="stg-input" type="number" min="0" max="90" value={form.graceDays} onChange={(e) => set("graceDays")(e.target.value)} aria-label="Grace days" style={{ width: 70 }} /> days
          </span>
        </Row>

        <Row title="Pause access when a payment is late" description="After the grace days, the family's learners see a 'please pay' screen until the overdue amount is paid — then everything switches straight back on. Hubs are reminded, never paused.">
          <Toggle checked={form.pauseAccess} onChange={set("pauseAccess")} label="Pause access when a payment is late" />
        </Row>
      </div>
    </SettingsSection>
  );
}
