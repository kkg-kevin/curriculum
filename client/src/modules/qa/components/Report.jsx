import RichContent from "../../assessments/components/RichContent";
import { FiCheck, FiMinus, FiX } from "react-icons/fi";
import { SUMMARY_PARTS, ScoreBadge, T, label, scoreLook } from "../shared";

// The score, worked out the way the server does (qa.rules.js's scoreReview) — for the live figure
// while a review is being filled in. Each scored item counts equally: yes full marks, no none, a
// rubric level its share of the top level; "not applicable" and comments are left out.
export function liveScore(template, answers) {
  if (!template) return { score: null, sectionScores: [] };
  const top = Math.max(...(template.scale || []).map((l) => l.score), 1);
  const all = [];
  const sectionScores = template.sections.map((s) => {
    const shares = s.criteria.map((c) => {
      const v = answers[c.id]?.value;
      if (c.kind === "yes_no") return v === "yes" ? 1 : v === "no" ? 0 : null;
      if (c.kind === "rubric" && v !== undefined && v !== null && v !== "na" && v !== "") return Number(v) / top;
      return null;
    }).filter((x) => x !== null);
    all.push(...shares);
    return { id: s.id, title: s.title, score: shares.length ? Math.round((shares.reduce((a, b) => a + b, 0) / shares.length) * 1000) / 10 : null };
  });
  return { score: all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 1000) / 10 : null, sectionScores };
}

// One bar per section, with its name and score above it — reads the same on a phone.
export function SectionBars({ sectionScores }) {
  const scored = (sectionScores || []).filter((s) => s.score != null);
  if (!scored.length) return null;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {scored.map((s) => {
        const look = scoreLook(s.score);
        return (
          <div key={s.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: look.color, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{s.score}%</span>
            </div>
            <div style={{ height: 7, marginTop: 4, borderRadius: 999, background: "#EEF1F4", overflow: "hidden" }} aria-hidden>
              <div style={{ width: `${Math.max(2, s.score)}%`, height: "100%", borderRadius: 999, background: look.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The score with its sections, as a report's headline.
export function ScoreHeader({ score, sectionScores }) {
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ textAlign: "center" }}>
        <ScoreBadge score={score} size="lg" />
        <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkMuted }}>Overall</p>
      </div>
      <div style={{ flex: "1 1 320px", minWidth: 0 }}><SectionBars sectionScores={sectionScores} /></div>
    </div>
  );
}

function Answer({ criterion, answer, scale }) {
  const v = answer?.value;
  if (criterion.kind === "comment") return null;
  if (v === "na") return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "#F3F4F6", color: T.inkMuted, fontSize: 12, fontWeight: 800 }}><FiMinus size={12} /> Not applicable</span>;
  if (criterion.kind === "yes_no") {
    if (v === "yes") return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "#ECFDF5", color: "#047857", fontSize: 12, fontWeight: 800 }}><FiCheck size={12} /> Yes</span>;
    if (v === "no") return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "#FEF2F2", color: "#B91C1C", fontSize: 12, fontWeight: 800 }}><FiX size={12} /> No</span>;
    return <span style={{ fontSize: 12, color: T.inkFaint }}>—</span>;
  }
  const level = (scale || []).find((l) => String(l.score) === String(v));
  if (!level) return <span style={{ fontSize: 12, color: T.inkFaint }}>—</span>;
  const top = Math.max(...scale.map((l) => l.score));
  const look = scoreLook((level.score / top) * 100);
  return <span style={{ padding: "3px 10px", borderRadius: 999, background: look.bg, color: look.color, fontSize: 12, fontWeight: 800 }}>{level.score} · {level.label}</span>;
}

// The summary parts (strengths, areas to improve, remarks) that have something in them.
export function SummaryParts({ summary, parts = SUMMARY_PARTS }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {parts.filter((p) => summary?.[p.key] !== undefined).map((p) => (
        <div key={p.key}>
          <p style={{ ...label, marginBottom: 4 }}>{p.label}</p>
          <RichContent html={summary?.[p.key] || ""} emptyText="—" />
        </div>
      ))}
    </div>
  );
}

// The whole report: the score, every item's answer and note, then the summary.
export function ReportView({ visit }) {
  const t = visit.template;
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ScoreHeader score={visit.score} sectionScores={visit.sectionScores} />
      {t?.sections.map((s) => (
        <div key={s.id} style={{ borderTop: "1px solid #F3F4F6", paddingTop: 14 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: T.ink }}>{s.title}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {s.criteria.map((c) => {
              const a = visit.answers?.[c.id];
              return (
                <div key={c.id} style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, color: "#374151", flex: "1 1 260px" }}>{c.text}</span>
                    <Answer criterion={c} answer={a} scale={t.scale} />
                  </div>
                  {a?.comment && <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted, padding: "6px 10px", borderLeft: "3px solid #D6E4EF", background: "#F8FAFC", borderRadius: "0 8px 8px 0", whiteSpace: "pre-line" }}>{a.comment}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 14 }}><SummaryParts summary={visit.summary} /></div>
    </div>
  );
}
