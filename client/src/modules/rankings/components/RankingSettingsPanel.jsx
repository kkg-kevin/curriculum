import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAward, FiCalendar, FiPlus, FiSliders, FiTrash2, FiUsers } from "react-icons/fi";
import { BRAND, FONT, card, cardHeading } from "../../../theme/brand";
import { errorOf, rankingsApi } from "../services/rankingsApi";

// Settings → Rankings (modules/rankings): whether learners and parents see class positions (for
// the workspace, and hub by hub), how the Learning Score is weighed, how much work ranks a learner
// and a class, how other children are named, the period ranked, and the workspace's own term dates
// (else Kenya's three terms). Staff always see class rankings; switching off only hides them from
// families and stops badge and weekly notices.

const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: `1px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer" };
const primary = { ...btn, background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" };
const input = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff", minWidth: 0 };
const label = { display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, minWidth: 0 };
const hint = { margin: 0, fontSize: 12.5, color: BRAND.muted, lineHeight: 1.5 };
const section = { ...card, padding: 18, display: "grid", gap: 12, gridTemplateColumns: "100%" };
const NAME_STYLES = [["initial", "First name and initial — \"Amani K.\""], ["first", "First name only — \"Amani\""], ["anonymous", "No names — \"A classmate\""]];

export default function RankingSettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["rankings", "settings"], queryFn: rankingsApi.settings });
  const [form, setForm] = useState(null);
  useEffect(() => { if (data) setForm(JSON.parse(JSON.stringify(data.settings))); }, [data]);
  const save = useMutation({
    mutationFn: () => rankingsApi.saveSettings(form),
    onSuccess: (saved) => {
      qc.setQueryData(["rankings", "settings"], { ...data, settings: saved.settings });
      qc.invalidateQueries({ queryKey: ["rankings"] });
      toast.success("Rankings settings saved");
    },
    onError: (err) => toast.error(errorOf(err, "Couldn't save the settings")),
  });
  if (isLoading || !form) return <p style={hint}>Loading…</p>;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const totalWeight = Object.values(form.weights).reduce((s, w) => s + (Number(w) || 0), 0);
  const hubOff = (id) => form.disabledHubIds.includes(id);

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: "grid", gap: 14, gridTemplateColumns: "100%", fontFamily: FONT, maxWidth: 900 }}>
      <section style={section}>
        <h3 style={cardHeading}><FiAward size={13} /> Class positions for families</h3>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, fontWeight: 700, color: BRAND.ink, cursor: "pointer" }}>
          <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} style={{ marginTop: 3 }} />
          <span>Show learners and parents their class position, badges and leaderboards, and send badge, &ldquo;moved up&rdquo; and weekly notices</span>
        </label>
        <p style={hint}>Switched off, families see nothing about positions; educators and staff still see each class&apos;s ranking. Which notices go by email is in Settings → Emails.</p>
        {form.enabled && data.hubs.length > 0 && (
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%" }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: BRAND.inkSoft }}>Hubs showing positions</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.hubs.map((h) => (
                <label key={h.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: `1px solid ${BRAND.border}`, fontSize: 12.5, fontWeight: 700, color: hubOff(h.id) ? BRAND.faint : BRAND.inkSoft, cursor: "pointer", background: hubOff(h.id) ? BRAND.greyTint : "#fff" }}>
                  <input type="checkbox" checked={!hubOff(h.id)} onChange={(e) => set("disabledHubIds", e.target.checked ? form.disabledHubIds.filter((x) => x !== h.id) : [...form.disabledHubIds, h.id])} />
                  {h.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={section}>
        <h3 style={cardHeading}><FiSliders size={13} /> The Learning Score</h3>
        <p style={hint}>How much each part counts. They needn&apos;t add up to 100 — each is its share of the total ({totalWeight}). A part with a weight of 0 isn&apos;t counted.</p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))" }}>
          {data.parts.map((p) => (
            <label key={p.key} style={label}>{p.label}
              <input type="number" min="0" max="100" style={input} value={form.weights[p.key]} onChange={(e) => set("weights", { ...form.weights, [p.key]: e.target.value === "" ? 0 : Number(e.target.value) })} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.muted }}>{totalWeight ? `${Math.round(((Number(form.weights[p.key]) || 0) / totalWeight) * 100)}% of the score` : "—"}</span>
            </label>
          ))}
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
          <label style={label}>Marked pieces of work before a learner is ranked
            <input type="number" min="1" max="50" style={input} value={form.minMarked} onChange={(e) => set("minMarked", Number(e.target.value))} />
          </label>
          <label style={label}>Ranked learners before a class shows places
            <input type="number" min="2" max="100" style={input} value={form.minClass} onChange={(e) => set("minClass", Number(e.target.value))} />
          </label>
        </div>
        <button type="button" style={{ ...btn, justifySelf: "start" }} onClick={() => setForm((f) => ({ ...f, weights: { ...data.defaults.weights }, minMarked: data.defaults.minMarked, minClass: data.defaults.minClass }))}>Back to the recommended</button>
      </section>

      <section style={section}>
        <h3 style={cardHeading}><FiUsers size={13} /> Other children on leaderboards</h3>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
          {NAME_STYLES.map(([key, text]) => (
            <label key={key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: BRAND.ink, cursor: "pointer" }}>
              <input type="radio" name="nameStyle" checked={form.nameStyle === key} onChange={() => set("nameStyle", key)} /> {text}
            </label>
          ))}
        </div>
        <p style={hint}>Families only ever see the top three and the learners around their own child — never the bottom of the class.</p>
      </section>

      <section style={section}>
        <h3 style={cardHeading}><FiCalendar size={13} /> The period ranked</h3>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: BRAND.ink, cursor: "pointer" }}>
            <input type="radio" name="period" checked={form.period === "term"} onChange={() => set("period", "term")} /> This term (resets each term)
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: BRAND.ink, cursor: "pointer" }}>
            <input type="radio" name="period" checked={form.period === "rolling30"} onChange={() => set("period", "rolling30")} /> The last 30 days (always moving)
          </label>
        </div>
        {form.period === "term" && (
          <>
            <p style={hint}>Your term dates. With none set, terms are January–April, May–August and September–December. During a holiday, the term just ended is shown.</p>
            {form.terms.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ ...label, flex: "2 1 180px" }}>Name
                  <input style={input} value={t.name} maxLength={60} onChange={(e) => set("terms", form.terms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                </label>
                <label style={{ ...label, flex: "1 1 150px" }}>From
                  <input type="date" style={input} value={t.from} onChange={(e) => set("terms", form.terms.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
                </label>
                <label style={{ ...label, flex: "1 1 150px" }}>To
                  <input type="date" style={input} value={t.to} onChange={(e) => set("terms", form.terms.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} />
                </label>
                <button type="button" style={{ ...btn, padding: 9 }} aria-label={`Remove ${t.name}`} onClick={() => set("terms", form.terms.filter((_, j) => j !== i))}><FiTrash2 size={14} /></button>
              </div>
            ))}
            <button type="button" style={{ ...btn, justifySelf: "start" }} onClick={() => {
              const y = new Date().getFullYear();
              set("terms", [...form.terms, { name: `Term ${form.terms.length + 1} ${y}`, from: `${y}-01-01`, to: `${y}-04-30` }]);
            }}><FiPlus size={14} /> Add a term</button>
          </>
        )}
      </section>

      <section style={{ ...section, background: BRAND.canvas }}>
        <h3 style={cardHeading}><FiAward size={13} /> Badges learners can earn</h3>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13, color: BRAND.inkSoft }}>
          {data.badges.map((b) => <li key={b.key}><strong>{b.label}</strong> — {b.description}</li>)}
        </ul>
        <p style={hint}>Each badge is earned once per class per period and announced to the learner and their parent.</p>
      </section>

      <div><button type="submit" style={primary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</button></div>
    </form>
  );
}
