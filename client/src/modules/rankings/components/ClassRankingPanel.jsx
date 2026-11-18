import { useQuery } from "@tanstack/react-query";
import { FiArrowDown, FiArrowUp, FiAward, FiMinus } from "react-icons/fi";
import { BRAND, FONT, card, cardHeading, pill } from "../../../theme/brand";
import { rankingsApi } from "../services/rankingsApi";

// The class's ranking for its educators, its hub and staff (the educator's class page, the
// admin / hub class page): every learner's place, Learning Score and the parts behind it, this
// term. Staff see every name and number; families see far less (PositionView).

const PARTS = [
  ["achievement", "Marked work"],
  ["attendance", "Attendance"],
  ["onTime", "On time"],
  ["growth", "Growth"],
  ["competencies", "Competencies"],
];
const th = { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${BRAND.border}`, whiteSpace: "nowrap" };
const td = { padding: "10px 12px", fontSize: 13, color: BRAND.inkSoft, borderBottom: `1px solid ${BRAND.line}`, whiteSpace: "nowrap" };

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

function Move({ movement }) {
  if (movement == null) return <span style={{ color: BRAND.faint }}>—</span>;
  if (movement === 0) return <span style={{ color: BRAND.muted, display: "inline-flex", alignItems: "center", gap: 3 }}><FiMinus size={12} /> 0</span>;
  const up = movement > 0;
  return <span style={{ color: up ? BRAND.mid : BRAND.goldText, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}>{up ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />}{Math.abs(movement)}</span>;
}

function Bar({ value }) {
  if (value == null) return <span style={{ color: BRAND.faint }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 54, height: 7, borderRadius: 999, background: BRAND.track, overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: `${Math.max(2, value)}%`, height: "100%", background: value >= 80 ? BRAND.navy : value >= 60 ? BRAND.sky : BRAND.gold }} />
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 28 }}>{Math.round(value)}</span>
    </span>
  );
}

export default function ClassRankingPanel({ classId }) {
  const { data, isLoading, error } = useQuery({ queryKey: ["rankings", "class", classId], queryFn: () => rankingsApi.forClass(classId), enabled: !!classId });

  return (
    <section style={{ ...card, padding: 18, fontFamily: FONT, display: "grid", gap: 12, gridTemplateColumns: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <h3 style={cardHeading}><FiAward size={13} /> Class ranking{data ? ` — ${data.term.label}` : ""}</h3>
        {data && <span style={{ fontSize: 12, color: BRAND.muted }}>Class average score {data.averages.score != null ? Math.round(data.averages.score) : "—"}</span>}
      </div>
      {isLoading && <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Working out the ranking…</p>}
      {error && <p style={{ margin: 0, fontSize: 13, color: BRAND.danger }}>The ranking can't be shown right now.</p>}
      {data && (
        <>
          <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted, lineHeight: 1.5 }}>
            Learning Score out of 100 from this term's work: marked work {data.weights.achievement}%, attendance {data.weights.attendance}%, work on time {data.weights.onTime}%, growth {data.weights.growth}%, competencies {data.weights.competencies}% (a part with nothing yet is left out). A learner is ranked from {data.minMarked} marked pieces; places show once {data.minClass} learners are ranked.
            {" "}Learners and parents see their own place in the top half of the class, a band below it, and others by first name only.
          </p>
          {!data.ranked && <p style={{ margin: 0, ...pill("waiting"), whiteSpace: "normal", borderRadius: 10, padding: "8px 12px", fontSize: 12.5 }}>Not ranked yet — {data.rankedCount} of {data.minClass} learners needed have {data.minMarked} marked pieces this term.</p>}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={th}>Place</th>
                  <th style={th}>Learner</th>
                  <th style={th}>Score</th>
                  <th style={th}>Move</th>
                  {PARTS.map(([, label]) => <th key={label} style={th}>{label}</th>)}
                  <th style={th}>Marked</th>
                  <th style={th}>Missed</th>
                </tr>
              </thead>
              <tbody>
                {data.learners.map((l) => (
                  <tr key={l.learnerId} style={{ opacity: l.eligible ? 1 : 0.7 }}>
                    <td style={{ ...td, fontWeight: 900, color: l.rank === 1 ? BRAND.goldText : BRAND.navy }}>{l.rank ? ordinal(l.rank) : "—"}</td>
                    <td style={{ ...td, fontWeight: 700, color: BRAND.ink, whiteSpace: "normal" }}>
                      {l.name}
                      {!l.eligible && <div style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.muted }}>{Math.max(0, data.minMarked - l.markedCount)} more marked {data.minMarked - l.markedCount === 1 ? "piece" : "pieces"} to be ranked</div>}
                    </td>
                    <td style={{ ...td, fontWeight: 900, color: BRAND.ink }}>{l.score != null ? Math.round(l.score) : "—"}{l.level && <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.muted }}>{l.level}</div>}</td>
                    <td style={td}><Move movement={l.movement} /></td>
                    {PARTS.map(([key]) => <td key={key} style={td}><Bar value={l.parts[key]} /></td>)}
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{l.markedCount}</td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums", color: l.missedCount ? BRAND.goldText : BRAND.inkSoft, fontWeight: l.missedCount ? 800 : 400 }}>{l.missedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.learners.length && <p style={{ margin: 0, padding: 20, textAlign: "center", fontSize: 13, color: BRAND.muted }}>No learners in this class yet.</p>}
          </div>
        </>
      )}
    </section>
  );
}
