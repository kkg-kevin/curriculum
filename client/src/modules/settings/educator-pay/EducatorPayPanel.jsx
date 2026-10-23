import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useClaimSettings, useUpdateClaimSettings } from "../../claims/hooks/useClaims";
import { formatMoney } from "../../claims/shared";
import { SettingsPage, SettingsSection, Field, FieldGrid, FooterNote, LoadState } from "../components/SettingsLayout";


function NumberInput({ id, value, onChange, placeholder, max, step = "1" }) {
  return <input id={id} className="stg-input" type="number" min="0" max={max} step={step} inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

// The part-time rates, each with the unit it pays for.
const RATES = [
  { key: "hourlyRate", label: "Per hour" },
  { key: "sessionRate", label: "Per session" },
  { key: "dailyRate", label: "Per day" },
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
  const [form, setForm] = useState({ sessionRate: "", hourlyRate: "", dailyRate: "", basePlusSessionRate: "", commissionRate: "", advancePercent: "", advanceCoveragePercent: "", advanceCoverageSessions: "" });

  useEffect(() => {
    if (data) {
      setForm({
        sessionRate: asText(data.sessionRate),
        hourlyRate: asText(data.hourlyRate),
        dailyRate: asText(data.dailyRate),
        basePlusSessionRate: asText(data.basePlusSessionRate),
        commissionRate: asText(data.commissionRate),
        advancePercent: asText(data.advancePercent),
        advanceCoveragePercent: data.advanceCoveragePercent ? String(data.advanceCoveragePercent) : "",
        advanceCoverageSessions: data.advanceCoverageSessions ? String(data.advanceCoverageSessions) : "",
      });
    }
  }, [data]);

  const currency = data?.currency || "KES";
  const rateValue = (key) => (form[key].trim() === "" ? null : Number(form[key]));
  const ratesValid = RATES.every(({ key }) => rateValue(key) === null || rateValue(key) > 0);
  const pct = Number(form.advancePercent);
  const pctValid = form.advancePercent.trim() !== "" && Number.isInteger(pct) && pct >= 0 && pct <= 100;
  // Course coverage before an advance: a % of the course's sessions OR a number of sessions,
  // whichever the educator reaches first. Empty = that one isn't used.
  const coveragePct = form.advanceCoveragePercent.trim() === "" ? 0 : Number(form.advanceCoveragePercent);
  const coverageSessions = form.advanceCoverageSessions.trim() === "" ? 0 : Number(form.advanceCoverageSessions);
  const coveragePctValid = Number.isInteger(coveragePct) && coveragePct >= 0 && coveragePct <= 100;
  const coverageSessionsValid = Number.isInteger(coverageSessions) && coverageSessions >= 0 && coverageSessions <= 1000;
  const coverageValid = coveragePctValid && coverageSessionsValid;
  // Base plus, a way of paying of its own: its own session rate (the base) plus a commission per
  // enrolled learner, each session. Both set, or both empty (not offered).
  const basePlusRate = rateValue("basePlusSessionRate");
  const commission = rateValue("commissionRate");
  const basePlusRateValid = basePlusRate === null || basePlusRate > 0;
  const commissionValid = commission === null || commission > 0;
  const basePlusOffered = basePlusRate > 0 && commission > 0;
  const basePlusHalfSet = (basePlusRate > 0) !== (commission > 0);
  const anyRate = RATES.some(({ key }) => rateValue(key) > 0) || basePlusOffered;
  const dirty = Boolean(data) && (RATES.some(({ key }) => rateValue(key) !== (data[key] ?? null)) || basePlusRate !== (data.basePlusSessionRate ?? null)
    || commission !== (data.commissionRate ?? null) || pct !== data.advancePercent
    || coveragePct !== (data.advanceCoveragePercent || 0) || coverageSessions !== (data.advanceCoverageSessions || 0));
  const valid = ratesValid && anyRate && pctValid && basePlusRateValid && commissionValid && !basePlusHalfSet && coverageValid;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        sessionRate: rateValue("sessionRate"),
        hourlyRate: rateValue("hourlyRate"),
        dailyRate: rateValue("dailyRate"),
        basePlusSessionRate: basePlusRate,
        commissionRate: commission,
        advancePercent: pct,
        advanceCoveragePercent: coveragePct,
        advanceCoverageSessions: coverageSessions,
      });
      toast.success("Educator pay saved");
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "Could not save educator pay");
    }
  };

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const opensAfter = Math.min(...[coveragePct ? Math.ceil((12 * coveragePct) / 100) : Infinity, coverageSessions || Infinity]);

  return (
    <SettingsPage
      title="Educator pay"
      description="What part-time educators are paid when they claim, set once for everyone. Full-time educators are paid outside the portal and don't claim — each educator's type is set on their profile."
    >
      <LoadState isLoading={isLoading} isError={isError} what="Educator pay" />

      {data && (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SettingsSection title={`Rates (${currency})`} description="Leave a rate empty if you don't pay that way.">
            <FieldGrid min={160}>
              {RATES.map((r) => (
                <Field key={r.key} label={r.label} htmlFor={`pay-${r.key}`}>
                  <NumberInput id={`pay-${r.key}`} value={form[r.key]} onChange={set(r.key)} placeholder="Not offered" step="0.001" />
                </Field>
              ))}
            </FieldGrid>
            {!ratesValid && <Field warning="Rates must be more than 0." />}
            {ratesValid && !anyRate && <Field warning="Set at least one rate, or no part-time educator can claim." />}
          </SettingsSection>

          <SettingsSection title="Base plus" description="Its own session rate plus a commission for each learner enrolled in the class, every session. Leave both empty if you don't pay this way.">
            <FieldGrid min={160}>
              <Field
                label={`Session rate (${currency})`}
                htmlFor="pay-basePlusSessionRate"
                warning={!basePlusRateValid ? "Must be more than 0." : commission > 0 && !(basePlusRate > 0) ? "Set the session rate too." : null}
              >
                <NumberInput id="pay-basePlusSessionRate" value={form.basePlusSessionRate} onChange={set("basePlusSessionRate")} placeholder="Not offered" step="0.001" />
              </Field>
              <Field
                label={`Commission per learner (${currency})`}
                htmlFor="pay-commissionRate"
                warning={!commissionValid ? "Must be more than 0." : basePlusRate > 0 && !(commission > 0) ? "Set the commission too." : null}
              >
                <NumberInput id="pay-commissionRate" value={form.commissionRate} onChange={set("commissionRate")} placeholder="Not offered" step="0.001" />
              </Field>
              <div />
            </FieldGrid>
            {basePlusOffered && basePlusRateValid && commissionValid && (
              <Field note={`With 12 learners: ${formatMoney(basePlusRate, currency)} + 12 × ${formatMoney(commission, currency)} = ${formatMoney(basePlusRate + 12 * commission, currency)} a session.`} />
            )}
          </SettingsSection>

          <SettingsSection
            title="Advance"
            description="A share of the course paid up front and taken off the full payment. It opens once the educator has delivered either minimum, whichever comes first — leave both empty to allow it from the start."
          >
            <FieldGrid min={160}>
              <Field label="Advance (% of course)" htmlFor="pay-advance" warning={pctValid ? null : "A whole number from 0 to 100."}>
                <NumberInput id="pay-advance" value={form.advancePercent} onChange={set("advancePercent")} max="100" />
              </Field>
              <Field label="Opens after (% of sessions)" htmlFor="pay-coverage-pct" warning={coveragePctValid ? null : "A whole number from 0 to 100."}>
                <NumberInput id="pay-coverage-pct" value={form.advanceCoveragePercent} onChange={set("advanceCoveragePercent")} placeholder="—" max="100" />
              </Field>
              <Field label="or after (sessions)" htmlFor="pay-coverage-sessions" warning={coverageSessionsValid ? null : "A whole number, 0 or more."}>
                <NumberInput id="pay-coverage-sessions" value={form.advanceCoverageSessions} onChange={set("advanceCoverageSessions")} placeholder="—" />
              </Field>
            </FieldGrid>
            {pctValid && coverageValid && (
              <Field note={coveragePct || coverageSessions
                ? `On a 12-session course: ${pct}% opens after ${opensAfter} delivered ${opensAfter === 1 ? "session" : "sessions"}.`
                : `${pct}% of the course, available from the start.`}
              />
            )}
          </SettingsSection>

          <SettingsSection
            title="Save changes"
            description={dirty ? "You have unsaved changes." : "Everything is saved."}
            aside={(
              <>
                <FooterNote>Applies to new claims; ones already sent keep their figures.</FooterNote>
                <button type="submit" className="stg-btn-primary" disabled={!dirty || !valid || save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
              </>
            )}
          />
        </form>
      )}
    </SettingsPage>
  );
}
