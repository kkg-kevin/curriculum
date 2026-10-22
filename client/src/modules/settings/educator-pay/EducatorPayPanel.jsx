import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useClaimSettings, useUpdateClaimSettings } from "../../claims/hooks/useClaims";
import { formatMoney } from "../../claims/shared";

const heading = { margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" };
const subheading = { margin: 0, fontSize: 13.5, fontWeight: 800, color: "#111827" };
const hint = { margin: "4px 0 0", fontSize: 12.5, color: "#6B7280", lineHeight: 1.5, maxWidth: 680 };
const label = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 };
const card = { padding: "16px 18px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#fff" };

// The part-time rates, each with the unit it pays for.
const RATES = [
  { key: "hourlyRate", label: "Hourly rate", unit: "an hour", example: (r) => `12 hours pay ${r}`, sample: 12 },
  { key: "sessionRate", label: "Session rate", unit: "a session", example: (r) => `A 12-session course pays ${r}`, sample: 12 },
  { key: "dailyRate", label: "Daily rate", unit: "a day", example: (r) => `10 days pay ${r}`, sample: 10 },
];

const asText = (value) => (value == null ? "" : String(value));

// Settings → Educator pay: what the workspace pays its educators, set once for all of them.
// Full time is a tag on the educator only — full-time educators don't claim. Part-time educators
// claim on one of the ways of paying tagged on them (Educators → edit), at the rate set here; a
// rate left empty isn't offered. A change applies to claims submitted from then on — a claim
// already sent keeps the figures it was sent with.
export default function EducatorPayPanel() {
  const { data, isLoading, isError } = useClaimSettings();
  const save = useUpdateClaimSettings();
  const [form, setForm] = useState({ sessionRate: "", hourlyRate: "", dailyRate: "", commissionRate: "", advancePercent: "" });

  useEffect(() => {
    if (data) {
      setForm({
        sessionRate: asText(data.sessionRate),
        hourlyRate: asText(data.hourlyRate),
        dailyRate: asText(data.dailyRate),
        commissionRate: asText(data.commissionRate),
        advancePercent: asText(data.advancePercent),
      });
    }
  }, [data]);

  const currency = data?.currency || "KES";
  const rateValue = (key) => (form[key].trim() === "" ? null : Number(form[key]));
  const ratesValid = RATES.every(({ key }) => rateValue(key) === null || rateValue(key) > 0);
  const anyRate = RATES.some(({ key }) => rateValue(key) > 0);
  const pct = Number(form.advancePercent);
  const pctValid = form.advancePercent.trim() !== "" && Number.isInteger(pct) && pct >= 0 && pct <= 100;
  // Base plus: a commission per enrolled learner, paid on top of the session rate each session.
  const commission = rateValue("commissionRate");
  const commissionValid = commission === null || commission > 0;
  const commissionNeedsBase = commission > 0 && !(rateValue("sessionRate") > 0);
  const dirty = Boolean(data) && (RATES.some(({ key }) => rateValue(key) !== (data[key] ?? null)) || commission !== (data.commissionRate ?? null) || pct !== data.advancePercent);
  const valid = ratesValid && anyRate && pctValid && commissionValid && !commissionNeedsBase;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        sessionRate: rateValue("sessionRate"),
        hourlyRate: rateValue("hourlyRate"),
        dailyRate: rateValue("dailyRate"),
        commissionRate: commission,
        advancePercent: pct,
      });
      toast.success("Educator pay saved");
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "Could not save educator pay");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section>
        <h2 style={heading}>Educator pay</h2>
        <p style={hint}>
          The rates every educator is paid at, set once for the whole workspace. Each educator is tagged full time or part time on their profile (Educators → edit), and a part-time educator with the ways of paying that apply to them.
        </p>
      </section>

      {isLoading && <p style={hint}>Loading…</p>}
      {isError && <p style={{ ...hint, color: "#B91C1C" }}>Educator pay could not be loaded.</p>}

      {data && (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
          <div style={card}>
            <h3 style={subheading}>Full time</h3>
            <p style={hint}>Full-time educators are paid outside the portal. They don&apos;t claim, and the claims pages tell them so.</p>
          </div>

          <div style={card}>
            <h3 style={subheading}>Part time</h3>
            <p style={hint}>
              A part-time educator claims for each course they teach, on one of the ways of paying tagged on them: the hours, sessions or days they delivered, times the rate here — or Base plus, below. Leave a rate empty if you don&apos;t pay that way.
            </p>
            <div style={{ marginTop: 14, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
              {RATES.map((r) => {
                const value = rateValue(r.key);
                return (
                  <div key={r.key}>
                    <label htmlFor={`pay-${r.key}`} style={label}>{r.label} ({currency})</label>
                    <input
                      id={`pay-${r.key}`}
                      className="stg-input"
                      type="number"
                      min="0"
                      step="0.001"
                      inputMode="decimal"
                      value={form[r.key]}
                      placeholder="Not offered"
                      onChange={(e) => setForm((f) => ({ ...f, [r.key]: e.target.value }))}
                    />
                    <p style={{ ...hint, fontSize: 11.5 }}>
                      {value > 0 ? `Per ${r.unit.replace(/^an? /, "")}. ${r.example(formatMoney(r.sample * value, currency))}.` : value === null ? "Empty: not offered." : "Must be more than 0."}
                    </p>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
              <h4 style={{ ...subheading, fontSize: 13 }}>Base plus</h4>
              <p style={{ ...hint, marginTop: 2 }}>
                Each session pays the session rate above plus this commission for every learner enrolled in the class. Leave it empty if you don&apos;t pay this way.
              </p>
              <div style={{ marginTop: 10, maxWidth: 260 }}>
                <label htmlFor="pay-commissionRate" style={label}>Commission per learner ({currency})</label>
                <input
                  id="pay-commissionRate"
                  className="stg-input"
                  type="number"
                  min="0"
                  step="0.001"
                  inputMode="decimal"
                  value={form.commissionRate}
                  placeholder="Not offered"
                  onChange={(e) => setForm((f) => ({ ...f, commissionRate: e.target.value }))}
                />
                <p style={{ ...hint, fontSize: 11.5, color: commissionNeedsBase || !commissionValid ? "#B45309" : hint.color }}>
                  {!commissionValid
                    ? "Must be more than 0."
                    : commission === null
                      ? "Empty: Base plus isn't offered."
                      : commissionNeedsBase
                        ? "Set the session rate too — Base plus is paid on top of it."
                        : `A session with 12 learners pays ${formatMoney(rateValue("sessionRate") + 12 * commission, currency)} (${formatMoney(rateValue("sessionRate"), currency)} + 12 × ${formatMoney(commission, currency)}).`}
                </p>
              </div>
            </div>

            <div style={{ marginTop: 18, maxWidth: 260 }}>
              <label htmlFor="pay-advance" style={label}>Advance (% of the course)</label>
              <input
                id="pay-advance"
                className="stg-input"
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.advancePercent}
                onChange={(e) => setForm((f) => ({ ...f, advancePercent: e.target.value }))}
              />
              <p style={{ ...hint, fontSize: 11.5 }}>
                {pctValid ? `While a course runs, an educator can ask for ${pct}% of its value up front; it comes off their full payment.` : "A whole number from 0 to 100."}
              </p>
            </div>
            {!anyRate && <p style={{ ...hint, color: "#B45309" }}>Set at least one rate, or no part-time educator can claim.</p>}
          </div>

          <p style={{ ...hint, marginTop: 0 }}>A change applies to claims sent from now on. Claims already sent keep the figures they were sent with.</p>
          <div>
            <button type="submit" className="stg-btn-primary" disabled={!dirty || !valid || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
