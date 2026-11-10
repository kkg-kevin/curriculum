import { FiX } from "react-icons/fi";
import { T } from "./ui";

/*
 * One row of filters above every analytics tab: the period (presets or your own dates), then hub
 * (workspace view only), curriculum, class, course, stage, pathway and gender. Each list narrows
 * to what the earlier choices allow; a choice that no longer fits is cleared.
 */

const PRESETS = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "365", label: "Last 12 months" },
  { key: "custom", label: "Choose dates" },
];

const kenyaToday = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
const daysBefore = (day, n) => new Date(new Date(`${day}T12:00:00Z`).getTime() - n * 86400000).toISOString().slice(0, 10);

// The period a preset stands for.
export function presetRange(key) {
  const to = kenyaToday();
  return { from: daysBefore(to, Number(key) - 1), to };
}

const field = { height: 36, padding: "0 10px", borderRadius: 10, border: `1px solid ${T.border}`, background: "#fff", color: T.ink, fontSize: 13, fontFamily: "Inter, sans-serif", minWidth: 0, maxWidth: "100%" };

function Select({ label, value, onChange, options, allLabel }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 150px", maxWidth: 260, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>{label}</span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={field}>
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export default function FilterBar({ filters, value, onChange, isHub }) {
  const f = filters || {};
  const set = (patch) => onChange(patch);

  const classes = (f.classes || []).filter((c) => (!value.hubId || c.hubId === value.hubId) && (!value.curriculumId || c.curriculumId === value.curriculumId));
  const classIds = new Set(classes.map((c) => c.id));
  const courses = (f.courses || []).filter((c) => (value.classId ? c.classIds.includes(value.classId) : c.classIds.some((id) => classIds.has(id))));
  const curricula = (f.curricula || []).filter((c) => !value.hubId || (f.classes || []).some((k) => k.hubId === value.hubId && k.curriculumId === c.id));
  const curriculumIds = new Set(value.curriculumId ? [value.curriculumId] : curricula.map((c) => c.id));
  const stages = (f.stages || []).filter((s) => curriculumIds.has(s.curriculumId));
  const pathways = (f.pathways || []).filter((p) => p.curriculumIds.some((id) => curriculumIds.has(id)));
  const curriculumName = new Map((f.curricula || []).map((c) => [c.id, c.name]));
  const hubName = new Map((f.hubs || []).map((h) => [h.id, h.name]));
  const active = ["hubId", "curriculumId", "classId", "courseId", "stageId", "pathway", "gender"].some((k) => value[k]);
  const className = (id) => (f.classes || []).find((c) => c.id === id)?.label || "Class";
  const chips = [
    value.hubId && { key: "hub", label: "Hub", value: hubName.get(value.hubId) || "Hub", clear: { hubId: "", classId: "", courseId: "" } },
    value.curriculumId && { key: "curriculum", label: "Curriculum", value: curriculumName.get(value.curriculumId) || "Curriculum", clear: { curriculumId: "", classId: "", courseId: "", stageId: "", pathway: "" } },
    value.classId && { key: "class", label: "Class", value: className(value.classId), clear: { classId: "", courseId: "" } },
    value.courseId && { key: "course", label: "Course", value: (f.courses || []).find((c) => c.id === value.courseId)?.name || "Course", clear: { courseId: "" } },
    value.stageId && { key: "stage", label: "Stage", value: (f.stages || []).find((x) => x.id === value.stageId)?.name || "Stage", clear: { stageId: "" } },
    value.pathway && { key: "pathway", label: "Pathway", value: value.pathway, clear: { pathway: "" } },
    value.gender && { key: "gender", label: "Gender", value: { female: "Girls", male: "Boys", other: "Other" }[value.gender] || value.gender, clear: { gender: "" } },
  ].filter(Boolean);

  return (
    <section style={{ background: "#fff", borderRadius: 16, border: `1px solid ${T.border}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 150px", maxWidth: 260, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>Period</span>
          <select value={value.preset} onChange={(e) => set(e.target.value === "custom" ? { preset: "custom" } : { preset: e.target.value, ...presetRange(e.target.value) })} style={field}>
            {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        {value.preset === "custom" && (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 140px", maxWidth: 220, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>From</span>
              <input type="date" value={value.from} max={value.to} onChange={(e) => e.target.value && set({ from: e.target.value })} style={field} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 140px", maxWidth: 220, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>To</span>
              <input type="date" value={value.to} min={value.from} max={kenyaToday()} onChange={(e) => e.target.value && set({ to: e.target.value })} style={field} />
            </label>
          </>
        )}
        {!isHub && (
          <Select label="Learning hub" value={value.hubId} allLabel="All hubs"
            options={(f.hubs || []).map((h) => ({ value: h.id, label: h.status === "active" || !h.status ? h.name : `${h.name} (${h.status})` }))}
            onChange={(hubId) => set({ hubId, classId: "", courseId: "" })} />
        )}
        <Select label="Curriculum" value={value.curriculumId} allLabel="All curricula" options={curricula.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(curriculumId) => set({ curriculumId, classId: "", courseId: "", stageId: "", pathway: "" })} />
        <Select label="Class" value={value.classId} allLabel="All classes"
          options={classes.map((c) => ({ value: c.id, label: [c.label, !isHub && !value.hubId ? hubName.get(c.hubId) : null, !value.curriculumId ? curriculumName.get(c.curriculumId) : null].filter(Boolean).join(" · ") }))}
          onChange={(classId) => set({ classId, courseId: "" })} />
        <Select label="Course" value={value.courseId} allLabel="All courses" options={courses.map((c) => ({ value: c.id, label: c.name }))} onChange={(courseId) => set({ courseId })} />
        <Select label="Stage" value={value.stageId} allLabel="All stages"
          options={stages.map((s) => ({ value: s.id, label: value.curriculumId ? s.name : `${s.name} · ${curriculumName.get(s.curriculumId) || ""}` }))} onChange={(stageId) => set({ stageId })} />
        <Select label="Pathway" value={value.pathway} allLabel="All pathways" options={pathways.map((p) => ({ value: p.name, label: p.name }))} onChange={(pathway) => set({ pathway })} />
        <Select label="Gender" value={value.gender} allLabel="Everyone" options={[{ value: "female", label: "Girls" }, { value: "male", label: "Boys" }, { value: "other", label: "Other" }]} onChange={(gender) => set({ gender })} />
      </div>
      {active && (
        // What's narrowing the figures, as chips (10 Nov 2026) — × takes one off. Remembered in this
        // browser with the period (AnalyticsPage).
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {chips.map((c) => (
            <span key={c.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 10px", borderRadius: 999, background: "#EAF6FD", border: "1px solid #BFE3F7", fontSize: 12, color: T.navy, maxWidth: "100%" }}>
              <span style={{ color: T.muted, fontWeight: 600 }}>{c.label}</span>
              <strong style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{c.value}</strong>
              <button type="button" onClick={() => set(c.clear)} aria-label={`Remove ${c.label}`}
                style={{ width: 20, height: 20, borderRadius: "50%", border: "none", background: "#fff", color: T.navy, cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>
                <FiX size={12} />
              </button>
            </span>
          ))}
          <button type="button" className="an-link" style={{ fontSize: 12.5, marginLeft: 4 }} onClick={() => set({ hubId: "", curriculumId: "", classId: "", courseId: "", stageId: "", pathway: "", gender: "" })}>Clear all</button>
        </div>
      )}
    </section>
  );
}
