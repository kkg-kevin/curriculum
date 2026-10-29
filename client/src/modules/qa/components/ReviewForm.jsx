import { useMemo, useState } from "react";
import { FiMessageSquare, FiSave, FiSend } from "react-icons/fi";
import RichTextEditor from "../../assessments/components/RichTextEditor";
import RichContent, { isEmptyHtml } from "../../assessments/components/RichContent";
import { reportHtml } from "../../checkins/shared";
import { liveScore, ScoreHeader } from "./Report";
import { SUMMARY_PARTS, T, btn, card, font, hint, input, label, todayKe } from "../shared";

const choice = (on, tone) => ({
  minHeight: 34, padding: "0 13px", borderRadius: 10, fontFamily: font, fontSize: 12.5, fontWeight: 800, cursor: "pointer",
  border: `1.5px solid ${on ? tone.color : "#E5E7EB"}`, background: on ? tone.bg : "#fff", color: on ? tone.color : "#374151",
});
const TONE = {
  yes: { bg: "#ECFDF5", color: "#047857" },
  no: { bg: "#FEF2F2", color: "#B91C1C" },
  na: { bg: "#F3F4F6", color: "#4B5563" },
  level: { bg: "#EFF6FF", color: "#1D4ED8" },
};

// One item to answer: yes / no / not applicable, a rubric level (showing what it looks like for this
// item), or a comment — and, for the first two, an optional note.
function Item({ criterion, scale, answer, onChange }) {
  const [noteOpen, setNoteOpen] = useState(Boolean(answer?.comment));
  const set = (patch) => onChange({ ...answer, ...patch });
  const value = answer?.value;
  const chosenLevel = criterion.kind === "rubric" ? scale.find((l) => String(l.score) === String(value)) : null;

  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #EEF1F4", background: value === undefined && criterion.kind !== "comment" ? "#fff" : "#FBFCFD", display: "grid", gap: 8 }}>
      <div>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{criterion.text}</p>
        {!isEmptyHtml(criterion.help) && (
          <div style={{ marginTop: 4, fontSize: 12.5, color: T.inkMuted }}><RichContent html={reportHtml(criterion.help)} /></div>
        )}
      </div>

      {criterion.kind === "yes_no" && (
        <div role="radiogroup" aria-label={criterion.text} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["yes", "Yes"], ["no", "No"], ["na", "Not applicable"]].map(([v, text]) => (
            <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => set({ value: v })} style={choice(value === v, TONE[v])}>{text}</button>
          ))}
        </div>
      )}

      {criterion.kind === "rubric" && (
        <>
          <div role="radiogroup" aria-label={criterion.text} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {scale.map((l) => (
              <button key={l.score} type="button" role="radio" aria-checked={String(value) === String(l.score)} onClick={() => set({ value: l.score })} title={criterion.descriptors?.[l.score] || l.label} style={choice(String(value) === String(l.score), TONE.level)}>
                {l.score} · {l.label}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={value === "na"} onClick={() => set({ value: "na" })} style={choice(value === "na", TONE.na)}>Not applicable</button>
          </div>
          {chosenLevel && criterion.descriptors?.[chosenLevel.score] && (
            <p style={{ ...hint, margin: 0, color: "#1D4ED8" }}>{chosenLevel.label}: {criterion.descriptors[chosenLevel.score]}</p>
          )}
        </>
      )}

      {criterion.kind === "comment" ? (
        <textarea value={answer?.comment || ""} onChange={(e) => set({ comment: e.target.value })} rows={3} maxLength={2000} placeholder="Write what you saw" aria-label={criterion.text} style={{ ...input, resize: "vertical" }} />
      ) : noteOpen ? (
        <textarea value={answer?.comment || ""} onChange={(e) => set({ comment: e.target.value })} rows={2} maxLength={2000} placeholder="A note on this item (optional)" aria-label={`Note on: ${criterion.text}`} style={{ ...input, resize: "vertical", fontSize: 12.5 }} />
      ) : (
        <button type="button" onClick={() => setNoteOpen(true)} style={{ justifySelf: "start", border: 0, background: "none", padding: 0, color: T.accentMid, fontWeight: 700, fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: font }}>
          <FiMessageSquare size={12} /> Add a note
        </button>
      )}
    </div>
  );
}

// The review of one visit: the day it happened, an answer per item, the strengths, the areas to
// improve and any overall remarks. "Save and finish later" keeps it (nobody visited sees it);
// "Send report" needs every yes / no and rubric item answered and the first two summary parts,
// then the educator is told. `sent` — correcting a report already sent (it stays sent).
export default function ReviewForm({ visit, onSave, saving, sent = false, onCancel }) {
  const template = visit.template;
  const [answers, setAnswers] = useState(() => visit.answers || {});
  const [summary, setSummary] = useState(() => ({ strengths: visit.summary?.strengths || "", improvements: visit.summary?.improvements || "", remarks: visit.summary?.remarks || "" }));
  const [visitDate, setVisitDate] = useState(() => (visit.scheduledDate <= todayKe() ? visit.scheduledDate : todayKe()));
  const [problems, setProblems] = useState([]);
  const live = useMemo(() => liveScore(template, answers), [template, answers]);

  if (!template) return <p style={{ ...hint, color: "#B91C1C" }}>This visit&apos;s template no longer exists — change the visit to use another one.</p>;

  const unanswered = template.sections.flatMap((s) => s.criteria.filter((c) => c.kind !== "comment" && answers[c.id]?.value === undefined));
  const submit = (send) => {
    if (send) {
      const missing = [];
      if (unanswered.length) missing.push(`Answer ${unanswered.length === 1 ? "1 item" : `${unanswered.length} items`} (or mark them not applicable)`);
      if (isEmptyHtml(summary.strengths)) missing.push("Write the strengths");
      if (isEmptyHtml(summary.improvements)) missing.push("Write the areas to improve");
      if (visitDate > todayKe()) missing.push("The visit can't be in the future");
      if (missing.length) { setProblems(missing); return; }
    }
    setProblems([]);
    onSave({ answers, summary, visitDate, submit: send }, (err) => setProblems((err.errors || []).map((e) => e.message)));
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ ...card, padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", justifyContent: "space-between" }}>
        <div>
          <label htmlFor="qa-visit-date" style={label}>Day of the visit</label>
          <input id="qa-visit-date" type="date" value={visitDate} max={todayKe()} onChange={(e) => setVisitDate(e.target.value)} style={{ ...input, width: "auto" }} />
          <p style={hint}>{visit.visitType === "surprise" ? "A surprise visit is recorded on the day you actually went." : "Change it if the visit happened on another day."}</p>
        </div>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <ScoreHeader score={live.score} sectionScores={live.sectionScores} />
          {unanswered.length > 0 && <p style={{ ...hint, marginTop: 6 }}>{unanswered.length} {unanswered.length === 1 ? "item" : "items"} still to answer.</p>}
        </div>
      </section>

      {/* The template's own description — what it's for and how to use it. */}
      {!isEmptyHtml(template.description) && (
        <section style={{ ...card, padding: "14px 20px", background: "#F8FBFE" }}>
          <p style={{ ...label, marginBottom: 4 }}>{template.name}</p>
          <RichContent html={reportHtml(template.description)} />
        </section>
      )}

      {template.sections.map((s) => (
        <section key={s.id} style={{ ...card, padding: "16px 20px", display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>{s.title}</h2>
          {s.criteria.map((c) => (
            <Item key={c.id} criterion={c} scale={template.scale || []} answer={answers[c.id]} onChange={(a) => setAnswers((prev) => ({ ...prev, [c.id]: a }))} />
          ))}
        </section>
      ))}

      <section style={{ ...card, padding: "16px 20px", display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>Summary</h2>
        {SUMMARY_PARTS.map((part) => (
          <div key={part.key}>
            <p style={label}>{part.label}{!part.required && <span style={{ fontWeight: 500, color: T.inkFaint }}> (optional)</span>}</p>
            <p style={{ ...hint, margin: "0 0 6px" }}>{part.help}</p>
            <RichTextEditor value={summary[part.key]} onChange={(html) => setSummary((f) => ({ ...f, [part.key]: html }))} minHeight={100} maxHeight={320} />
          </div>
        ))}
        {problems.length > 0 && <div style={{ color: "#B91C1C", fontSize: 12.5 }}>{problems.map((p) => <p key={p} style={{ margin: 0 }}>{p}</p>)}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
          {sent ? (
            <>
              <button type="button" className="ci-btn" onClick={onCancel} style={btn("secondary")}>Cancel</button>
              <button type="button" className="ci-btn" onClick={() => submit(true)} disabled={saving} style={btn("primary", { disabled: saving })}>{saving ? "Saving…" : "Save changes"}</button>
            </>
          ) : (
            <>
              <button type="button" className="ci-btn" onClick={() => submit(false)} disabled={saving} style={btn("secondary", { disabled: saving })}><FiSave size={14} /> Save and finish later</button>
              <button type="button" className="ci-btn" onClick={() => submit(true)} disabled={saving} style={btn("primary", { disabled: saving })}><FiSend size={14} /> {saving ? "Sending…" : "Send report"}</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
