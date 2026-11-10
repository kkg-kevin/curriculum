import { useEffect, useState } from "react";
import { SettingsPage, SettingsSection, Field, FieldGrid, LoadState } from "../settings/components/SettingsLayout";
import { btn, input } from "../qa/shared";
import { BRAND as C } from "../../theme/brand";
import { useMentorStandardSettings, useSaveMentorStandards } from "./standards";

// Settings → Mentor standards: the bar every mentor in the workspace is measured against — on their
// profile (which they see too), and in Reports & Analytics → Educators. Each standard: on / off, a
// target (meets it), a minimum (below it is "below"; between the two is "close"), and the evidence
// it needs before it counts. New mentors get a grace period; falling below a standard can tell their
// supervisor (or you, when they have none). Server: modules/mentor-standards/.

const Toggle = ({ checked, onChange, children, id }) => (
  <label htmlFor={id} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "#1F2937", cursor: "pointer" }}>
    <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
    <span>{children}</span>
  </label>
);

const unitText = (unit) => (unit === "★" ? "stars" : unit === "%" ? "%" : "");

export default function MentorStandardsPanel() {
  const { data, isLoading, isError } = useMentorStandardSettings();
  const save = useSaveMentorStandards();
  const [form, setForm] = useState(null);
  useEffect(() => { if (data) setForm(data.settings); }, [data]);
  if (!form || !data) return <LoadState isLoading={isLoading} isError={isError} what="the mentor standards" />;

  const defs = data.definitions;
  const setStandard = (key, patch) => setForm((f) => ({ ...f, standards: { ...f.standards, [key]: { ...f.standards[key], ...patch } } }));
  const numberOf = (v) => (v === "" ? "" : Number(v));
  const resetDefaults = () => setForm((f) => ({ ...f, standards: Object.fromEntries(defs.map((d) => [d.key, { ...d.defaults }])) }));
  const onCount = defs.filter((d) => form.standards[d.key]?.enabled).length;

  const footer = (
    <>
      <button type="button" className="ci-btn" disabled={save.isPending} onClick={() => save.mutate(form)} style={btn("primary", { disabled: save.isPending })}>
        {save.isPending ? "Saving…" : "Save standards"}
      </button>
      <button type="button" className="ci-btn" onClick={resetDefaults} style={btn("secondary")}>Use the suggested values</button>
      <span style={{ fontSize: 12.5, color: C.muted }}>{onCount} of {defs.length} standards on</span>
    </>
  );

  return (
    <SettingsPage
      title="Mentor standards"
      description="One bar for every mentor. Each mentor's profile shows where they stand against it (they see their own), and Reports & Analytics → Educators shows everyone's, with who needs support. Pay is never part of it."
    >
      <SettingsSection title="How standards are applied" description="A standard counts once there's enough evidence for it. Until then a mentor shows “Not enough data yet”, never a fail.">
        <FieldGrid min={240}>
          <div style={{ maxWidth: 320 }}>
          <Field label="Grace period for new mentors" htmlFor="ms-grace" note="Days from when they're added. Their figures show, but nothing is marked below.">
            <input id="ms-grace" type="number" min={0} max={365} value={form.graceDays} onChange={(e) => setForm((f) => ({ ...f, graceDays: numberOf(e.target.value) }))} style={input} />
          </Field>
          </div>
        </FieldGrid>
        <Toggle id="ms-notify" checked={form.notifyBelow} onChange={(v) => setForm((f) => ({ ...f, notifyBelow: v }))}>
          When a mentor falls below a standard, tell their supervisor (or the admins, if they have none), once a month per standard, suggesting a quality-review visit
        </Toggle>
      </SettingsSection>

      <SettingsSection
        title="The standards"
        description="Target: meets the standard. Minimum: worse than this is “Below”; between the minimum and the target is “Close”. Evidence: how much there must be before it counts."
        footer={footer}
      >
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
          {defs.map((d) => {
            const s = form.standards[d.key];
            const on = Boolean(s?.enabled);
            const unit = unitText(d.unit);
            return (
              <div key={d.key} style={{ border: `1px solid ${on ? C.skyBorder : C.border}`, background: on ? "#fff" : C.canvas, borderRadius: 12, padding: "12px 14px", display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <input id={`ms-on-${d.key}`} type="checkbox" checked={on} onChange={(e) => setStandard(d.key, { enabled: e.target.checked })} style={{ marginTop: 4 }} aria-label={`${d.label} on`} />
                  <label htmlFor={`ms-on-${d.key}`} style={{ minWidth: 0, cursor: "pointer" }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: C.ink }}>{d.label}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>{d.describe}</span>
                  </label>
                </div>
                {on && (
                  <FieldGrid min={150}>
                    <Field label={`Target${unit ? ` (${unit})` : ""}`} htmlFor={`ms-t-${d.key}`} note={d.higherIsBetter ? "At least this meets it" : "At most this meets it"}>
                      <input id={`ms-t-${d.key}`} type="number" min={0} max={d.max} step={d.step} value={s.target} onChange={(e) => setStandard(d.key, { target: numberOf(e.target.value) })} style={input} />
                    </Field>
                    <Field label={`Minimum${unit ? ` (${unit})` : ""}`} htmlFor={`ms-m-${d.key}`} note={d.higherIsBetter ? "Below this is “Below”" : "Above this is “Below”"}>
                      <input id={`ms-m-${d.key}`} type="number" min={0} max={d.max} step={d.step} value={s.minimum} onChange={(e) => setStandard(d.key, { minimum: numberOf(e.target.value) })} style={input} />
                    </Field>
                    <Field label="Evidence needed" htmlFor={`ms-e-${d.key}`} note={`At least this many ${d.evidence[1]}`}>
                      <input id={`ms-e-${d.key}`} type="number" min={0} max={500} value={s.minEvidence} onChange={(e) => setStandard(d.key, { minEvidence: numberOf(e.target.value) })} style={input} />
                    </Field>
                  </FieldGrid>
                )}
              </div>
            );
          })}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
