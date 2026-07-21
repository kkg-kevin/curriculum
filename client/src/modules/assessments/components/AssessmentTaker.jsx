import { useState } from "react";
import { normalizeLegacyItem } from "../schemas/assessment.schema";
import RichContent from "./RichContent";

const T = { accent: "#25476a", accentLight: "#38aae1", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB", tintBg: "#e8f5fb", tintBorder: "#a8d5ee" };

const fieldStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9,
  border: `1.5px solid ${T.border}`, fontSize: 13.5, fontFamily: "Inter, sans-serif", color: T.ink, outline: "none",
};

const FILE_KINDS = ["documentUpload", "imageUpload", "videoUpload", "audioUpload", "codeUpload"];
const TEXT_KINDS = ["shortAnswer", "longAnswer", "essay", "reflection", "scenarioResponse", "openEnded", "practicalTask"];

function QuestionShell({ index, item, children }) {
  return (
    <div style={{ padding: "16px 18px", backgroundColor: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.accent, flexShrink: 0 }}>{index + 1}.</span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
          <RichContent html={item.question} />
        </div>
      </div>
      <div style={{ marginLeft: 22 }}>{children}</div>
    </div>
  );
}

function McqField({ item, value, onChange }) {
  const options = item.options?.length ? item.options : (item.kind === "trueFalse" ? ["True", "False"] : []);

  // mcqMultiple stores its correct answer as a comma-joined string of every right option (see
  // grading.utils.js), so more than one can be true — a radio group can't represent that.
  if (item.kind === "mcqMultiple") {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (opt) => onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt) => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: T.ink, cursor: "pointer" }}>
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((opt) => (
        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: T.ink, cursor: "pointer" }}>
          <input type="radio" name={item.id} checked={value === opt} onChange={() => onChange(opt)} />
          {opt}
        </label>
      ))}
    </div>
  );
}

function FillBlankField({ item, value, onChange }) {
  const blanks = item.blanks || [];
  const answers = Array.isArray(value) ? value : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {blanks.map((_, i) => (
        <input
          key={i}
          type="text"
          style={fieldStyle}
          placeholder={`Blank ${i + 1}`}
          value={answers[i] || ""}
          onChange={(e) => { const next = [...answers]; next[i] = e.target.value; onChange(next); }}
        />
      ))}
    </div>
  );
}

function OrderingField({ item, value, onChange }) {
  const order = Array.isArray(value) && value.length === item.sequence?.length ? value : (item.sequence || []);
  const move = (i, dir) => {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {order.map((step, i) => (
        <div key={step} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.inkFaint, width: 16, flexShrink: 0 }}>{i + 1}</span>
          <span style={{ flex: 1, fontSize: 13 }}>{step}</span>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", cursor: i === 0 ? "not-allowed" : "pointer", color: T.inkMuted }}>↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} style={{ width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", cursor: i === order.length - 1 ? "not-allowed" : "pointer", color: T.inkMuted }}>↓</button>
          </div>
        </div>
      ))}
      <p style={{ margin: 0, fontSize: 11, color: T.inkFaint, fontStyle: "italic" }}>Use the arrows to put these in the correct order.</p>
    </div>
  );
}

function MatchingField({ item, value, onChange }) {
  const pairs = item.pairs || [];
  const rights = pairs.map((p) => p.right);
  const answers = Array.isArray(value) ? value : [];
  const answerFor = (left) => answers.find((a) => a.left === left)?.right || "";
  const setAnswer = (left, right) => {
    const next = answers.filter((a) => a.left !== left);
    if (right) next.push({ left, right });
    onChange(next);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {pairs.map((p) => (
        <div key={p.left} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, minWidth: 140 }}>{p.left}</span>
          <span style={{ color: T.inkFaint }}>↔</span>
          <select value={answerFor(p.left)} onChange={(e) => setAnswer(p.left, e.target.value)} style={{ ...fieldStyle, width: "auto", minWidth: 160 }}>
            <option value="">Choose a match…</option>
            {rights.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

function TextField({ value, onChange, placeholder }) {
  return (
    <textarea
      style={{ ...fieldStyle, minHeight: 90, resize: "vertical", fontFamily: "Inter, sans-serif" }}
      value={value || ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ItemField({ item, value, onChange }) {
  if (["mcqSingle", "mcqMultiple", "trueFalse"].includes(item.kind)) return <McqField item={item} value={value} onChange={onChange} />;
  if (item.kind === "fillBlank") return <FillBlankField item={item} value={value} onChange={onChange} />;
  if (item.kind === "ordering") return <OrderingField item={item} value={value} onChange={onChange} />;
  if (item.kind === "matching") return <MatchingField item={item} value={value} onChange={onChange} />;
  if (item.kind === "externalLink") return <TextField value={value} onChange={onChange} placeholder="Paste a link…" />;
  if (FILE_KINDS.includes(item.kind)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: "#B45309", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "6px 10px" }}>
          File upload isn't available yet — describe your submission or paste a link instead, and check in with your teacher.
        </p>
        <TextField value={value} onChange={onChange} placeholder="Describe your submission, or paste a link…" />
      </div>
    );
  }
  if (TEXT_KINDS.includes(item.kind)) return <TextField value={value} onChange={onChange} placeholder="Type your answer…" />;
  return <TextField value={value} onChange={onChange} placeholder="Type your answer…" />;
}

// Interactive item-answering surface for the learner "take assessment" flow. Deliberately
// covers only what has an unambiguous response shape the server's grading.utils.js already
// knows how to read (see that file's AUTO_GRADABLE_KINDS + the response contract documented
// there) — file-upload kinds get an honest "not supported yet" note rather than a fake widget.
export default function AssessmentTaker({ assessment, initialAnswers = [], onChange }) {
  const [answers, setAnswers] = useState(() => {
    const map = new Map((initialAnswers || []).map((a) => [a.itemId, a.response]));
    return map;
  });

  const items = (assessment.items || []).map(normalizeLegacyItem);

  const setResponse = (itemId, response) => {
    const next = new Map(answers);
    next.set(itemId, response);
    setAnswers(next);
    onChange?.([...next.entries()].map(([id, resp]) => ({ itemId: id, response: resp })));
  };

  if (items.length === 0) {
    return (
      <div style={{ padding: "18px 20px", backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}`, borderRadius: 12 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: T.accent }}>
          This assessment doesn't have questions to answer here — it's graded from your teacher's own review (a project, deliverable, or in-class observation). Submit when you're ready for your teacher to grade it.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item, i) => (
        <QuestionShell key={item.id} index={i} item={item}>
          <ItemField item={item} value={answers.get(item.id)} onChange={(v) => setResponse(item.id, v)} />
        </QuestionShell>
      ))}
    </div>
  );
}
