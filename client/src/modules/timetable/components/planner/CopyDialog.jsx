import { useMemo, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { Modal, QaStyles, btn } from "../../../qa/shared";
import { BRAND, FONT, pill } from "../../../../theme/brand";
import { plannerApi, usePlannerMutation } from "../../hooks/usePlanner";

// Copy one class's weekly lessons to other classes, at any hub: choose, see what would happen to
// each, then copy to the ones that are ready. The others are left exactly as they are.

const STATE = {
  ready: { label: "Ready", tone: "good" },
  already_set: { label: "Already set", tone: "neutral" },
  clash: { label: "Clash", tone: "danger" },
  missing_educator: { label: "Missing educator", tone: "waiting" },
  missing_course: { label: "Course not on its curriculum", tone: "waiting" },
};

export default function CopyDialog({ source, classes, onClose }) {
  // Never onto a class of a bootcamp run that has ended (26 Nov 2026): copy the old run's lessons
  // onto the new run's classes instead.
  const candidates = useMemo(() => classes.filter((c) => c.id !== source.id && c.run?.state !== "ended"), [classes, source.id]);
  const sameGrade = useMemo(() => candidates.filter((c) => c.curriculumId === source.curriculumId && c.gradeId === source.gradeId), [candidates, source]);
  const [chosen, setChosen] = useState(() => new Set());
  const [onlyMatching, setOnlyMatching] = useState(sameGrade.length > 0);
  const [withDates, setWithDates] = useState(true);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const check = usePlannerMutation(plannerApi.copyPreview, null);
  const apply = usePlannerMutation(plannerApi.copyApply, (r) => `Copied to ${r.copied} class${r.copied === 1 ? "" : "es"}`);

  const shown = onlyMatching ? sameGrade : candidates;
  const byHub = useMemo(() => {
    const map = new Map();
    for (const c of shown) map.set(c.hubName, [...(map.get(c.hubName) || []), c]);
    return [...map.entries()];
  }, [shown]);
  const toggle = (id) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const body = { fromClassId: source.id, toClassIds: [...chosen], withDates };
  const ready = preview?.ready || 0;

  const footer = result ? <button type="button" className="ci-btn" onClick={onClose} style={btn("primary")}>Done</button>
    : preview ? (
      <>
        <button type="button" className="ci-btn" onClick={() => setPreview(null)} style={btn("secondary")}>Back</button>
        <button type="button" className="ci-btn" disabled={!ready || apply.isPending} onClick={() => apply.mutate(body, { onSuccess: setResult })} style={btn("primary", { disabled: !ready || apply.isPending })}>{apply.isPending ? "Copying…" : ready ? `Copy to ${ready} class${ready === 1 ? "" : "es"}` : "Nothing ready to copy"}</button>
      </>
    ) : (
      <>
        <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" disabled={!chosen.size || check.isPending} onClick={() => check.mutate(body, { onSuccess: setPreview })} style={btn("primary", { disabled: !chosen.size || check.isPending })}>{check.isPending ? "Checking…" : `Check ${chosen.size || ""} class${chosen.size === 1 ? "" : "es"}`.replace("  ", " ")}</button>
      </>
    );

  return (
    <Modal title={`Copy ${source.label}'s timetable`} onClose={onClose} width={620} footer={footer}>
      <QaStyles />
      {result ? (
        <div style={{ display: "grid", gap: 7, gridTemplateColumns: "100%", fontFamily: FONT }}>
          {result.results.map((r) => (
            <div key={r.classId} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 9, background: BRAND.canvas }}>
              {r.copied ? <FiCheckCircle color={BRAND.mid} style={{ flexShrink: 0, marginTop: 2 }} /> : <span style={{ width: 14, flexShrink: 0 }} />}
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{r.label} <span style={{ fontWeight: 500, color: BRAND.muted }}>· {r.hubName}</span></p>
                <p style={{ margin: "1px 0 0", fontSize: 12.5, color: BRAND.muted }}>
                  {r.copied ? `${r.lessons} lesson${r.lessons === 1 ? "" : "s"} added${r.datesLeft ? `. ${r.datesLeft} start date${r.datesLeft === 1 ? "" : "s"} still to set` : ""}.` : `Left as it was: ${r.problems[0] || STATE[r.status]?.label}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : preview ? (
        <div style={{ display: "grid", gap: 7, gridTemplateColumns: "100%", fontFamily: FONT }}>
          <p style={{ margin: "0 0 2px", fontSize: 13, color: BRAND.inkSoft }}>Only classes marked Ready are copied. Each keeps its own educators; rooms are not copied.</p>
          {preview.rows.map((r) => {
            const state = STATE[r.status];
            return (
              <div key={r.classId} style={{ padding: "8px 10px", borderRadius: 9, background: BRAND.canvas }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{r.label} <span style={{ fontWeight: 500, color: BRAND.muted }}>· {r.hubName}</span></span>
                  <span style={pill(state.tone)}>{state.label}{r.status === "ready" ? ` · ${r.toAdd} lesson${r.toAdd === 1 ? "" : "s"}` : ""}</span>
                </div>
                {r.problems.length > 0 && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: BRAND.muted }}>{r.problems.slice(0, 2).join(". ")}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontFamily: FONT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: BRAND.inkSoft, cursor: "pointer" }}><input type="checkbox" checked={onlyMatching} onChange={(e) => setOnlyMatching(e.target.checked)} /> Same grade and curriculum only</label>
            <button type="button" onClick={() => setChosen(new Set(shown.map((c) => c.id)))} style={{ padding: 0, border: "none", background: "none", color: BRAND.mid, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>Select all</button>
            <button type="button" onClick={() => setChosen(new Set())} style={{ padding: 0, border: "none", background: "none", color: BRAND.muted, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>Clear</button>
          </div>
          {!shown.length && <p style={{ margin: "10px 0", fontSize: 13, color: BRAND.muted }}>No other class matches. Untick "Same grade and curriculum only" to see them all.</p>}
          <div style={{ maxHeight: 300, overflowY: "auto", display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
            {byHub.map(([hub, list]) => (
              <section key={hub}>
                <h3 style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 800, color: BRAND.muted }}>{hub}</h3>
                {list.map((c) => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", fontSize: 13.5, color: BRAND.ink, cursor: "pointer" }}>
                    <input type="checkbox" checked={chosen.has(c.id)} onChange={() => toggle(c.id)} style={{ width: 16, height: 16 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>{c.label}</span>
                    {c.lessons.length > 0 && <span style={{ fontSize: 11.5, color: BRAND.faint }}>{c.lessons.length} lesson{c.lessons.length === 1 ? "" : "s"}</span>}
                  </label>
                ))}
              </section>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 13, color: BRAND.inkSoft, cursor: "pointer" }}><input type="checkbox" checked={withDates} onChange={(e) => setWithDates(e.target.checked)} /> Use the same start dates where they fit</label>
        </div>
      )}
    </Modal>
  );
}
