import { useEffect, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { SettingsPage, SettingsSection, Field, FieldGrid, LoadState } from "../../settings/components/SettingsLayout";
import { btn, input } from "../../qa/shared";
import { useFeedbackSettings, useSaveFeedbackSettings } from "../hooks/useMentorReviews";

// Settings → Parent feedback: whether parents review the mentors teaching their children, what they
// rate (up to 8 things), after how many sessions, the mid-course check-in, and whether hubs see
// their educators' averages. Educators always see their feedback only as an anonymous summary, from
// 3 reviews; a concern always goes to the admins and the supervisor at once.

const Toggle = ({ checked, onChange, children }) => (
  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "#1F2937", cursor: "pointer" }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
    <span>{children}</span>
  </label>
);

export default function FeedbackSettingsPanel() {
  const { data, isLoading, isError } = useFeedbackSettings();
  const save = useSaveFeedbackSettings();
  const [form, setForm] = useState(null);
  useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return <LoadState isLoading={isLoading} isError={isError} what="the parent feedback settings" />;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setAspect = (i, label) => set({ aspects: form.aspects.map((a, j) => (j === i ? { ...a, label } : a)) });
  const removeAspect = (i) => set({ aspects: form.aspects.filter((_, j) => j !== i) });
  const addAspect = () => set({ aspects: [...form.aspects, { key: "", label: "" }] });
  const valid = form.aspects.some((a) => a.label.trim());

  return (
    <SettingsPage title="Parent feedback" description="Parents review the educators teaching their children (and TOT learners their trainers). Educators see only an anonymous summary once 3 families have reviewed them; a conduct concern goes to you and their supervisor at once.">
      <SettingsSection
        title="Reviews"
        description="Parents can review a mentor once their child has attended a few sessions — and are asked twice: a check-in while the course runs, and when its final report is published."
        footer={(
          <button type="button" className="ci-btn" disabled={!valid || save.isPending} onClick={() => save.mutate({ ...form, aspects: form.aspects.filter((a) => a.label.trim()) })} style={btn("primary", { disabled: !valid || save.isPending })}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        )}
      >
        <Toggle checked={form.enabled} onChange={(v) => set({ enabled: v })}>Parents can review their children&apos;s mentors</Toggle>
        <FieldGrid min={220}>
          <Field label="Sessions attended before a review" htmlFor="mr-min" note="Nobody rates a mentor they haven't seen.">
            <input id="mr-min" type="number" min={0} max={50} value={form.minSessions} onChange={(e) => set({ minSessions: Number(e.target.value) })} style={input} />
          </Field>
          <Field label="Mid-course check-in after" htmlFor="mr-mid" note="Sessions attended. Never before the number above.">
            <input id="mr-mid" type="number" min={1} max={100} value={form.midCourseAfterSessions} disabled={!form.midCourse} onChange={(e) => set({ midCourseAfterSessions: Number(e.target.value) })} style={input} />
          </Field>
        </FieldGrid>
        <Toggle checked={form.midCourse} onChange={(v) => set({ midCourse: v })}>Ask for a mid-course check-in (the end-of-course request always goes out)</Toggle>
        <Toggle checked={form.hubsSeeAverages} onChange={(v) => set({ hubsSeeAverages: v })}>Hubs see their own educators&apos; averages (never comments or names; from 3 reviews)</Toggle>
      </SettingsSection>

      <SettingsSection title="What parents rate" description="Each on 1–5 stars, besides the overall rating. Up to 8. Renaming one keeps its earlier ratings; removing one stops asking it.">
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
          {form.aspects.map((a, i) => (
            <div key={a.key || `new-${i}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input aria-label={`Aspect ${i + 1}`} value={a.label} maxLength={80} onChange={(e) => setAspect(i, e.target.value)} placeholder="e.g. Engages my child" style={{ ...input, flex: 1 }} />
              <button type="button" className="ci-btn" aria-label={`Remove ${a.label || "aspect"}`} onClick={() => removeAspect(i)} disabled={form.aspects.length <= 1} style={btn("secondary", { size: "sm", disabled: form.aspects.length <= 1 })}><FiTrash2 size={13} /></button>
            </div>
          ))}
          {form.aspects.length < 8 && (
            <button type="button" className="ci-btn" onClick={addAspect} style={{ ...btn("secondary", { size: "sm" }), alignSelf: "flex-start" }}><FiPlus size={13} style={{ marginRight: 5 }} /> Add one</button>
          )}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
