import { useMemo, useState } from "react";
import { normalizeLegacyItem, entryMarks } from "../schemas/assessment.schema";
import RichContent from "./RichContent";

const T = { accent: "#25476a", accentLight: "#38aae1", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const AUTO_GRADABLE_KINDS = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank"];

const fieldStyle = {
  boxSizing: "border-box", padding: "7px 10px", borderRadius: 8,
  border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink, outline: "none",
};

function formatResponse(response) {
  if (response == null || response === "") return <em style={{ color: T.inkFaint }}>No answer given</em>;
  if (Array.isArray(response)) {
    if (response.length && typeof response[0] === "object") {
      return response.map((p) => `${p.left} → ${p.right}`).join(", ");
    }
    return response.join(", ");
  }
  return String(response);
}

function AutoGradedRow({ index, item, response, autoResult }) {
  const correct = autoResult?.correct;
  return (
    <div style={{ padding: "12px 14px", backgroundColor: correct ? "#ECFDF5" : "#FFF5F5", border: `1px solid ${correct ? "#A7F3D0" : "#FECACA"}`, borderRadius: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{index + 1}.</span>
        <div style={{ flex: 1, fontSize: 13 }}><RichContent html={item.question} /></div>
        <span style={{ fontSize: 11, fontWeight: 700, color: correct ? "#059669" : "#DC2626", whiteSpace: "nowrap" }}>
          {correct ? "✓ Correct" : "✗ Incorrect"} · {autoResult?.marksAwarded ?? 0}/{autoResult?.maxMarks ?? entryMarks(item)}
        </span>
      </div>
      <p style={{ margin: "0 0 0 20px", fontSize: 12.5, color: T.inkMuted }}>Answer: {formatResponse(response)}</p>
    </div>
  );
}

function ManualGradeRow({ index, item, response, feedback, onChange }) {
  const max = entryMarks(item);
  return (
    <div style={{ padding: "14px 16px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{index + 1}.</span>
        <div style={{ flex: 1, fontSize: 13 }}><RichContent html={item.question} /></div>
      </div>
      <p style={{ margin: "0 0 0 20px", fontSize: 12.5, color: T.ink, backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
        {formatResponse(response)}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 20, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: T.inkMuted, display: "flex", alignItems: "center", gap: 6 }}>
          Marks
          <input type="number" min={0} max={max} value={feedback.marks} onChange={(e) => onChange({ ...feedback, marks: Number(e.target.value) })} style={{ ...fieldStyle, width: 60 }} />
          / {max}
        </label>
        <input type="text" placeholder="Feedback (optional)" value={feedback.comment} onChange={(e) => onChange({ ...feedback, comment: e.target.value })} style={{ ...fieldStyle, flex: 1, minWidth: 180 }} />
      </div>
    </div>
  );
}

function RubricRow({ criterion, feedback, onChange }) {
  const max = entryMarks(criterion);
  return (
    <div style={{ padding: "14px 16px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{criterion.criterion}</p>
      {criterion.description && <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>{criterion.description}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: T.inkMuted, display: "flex", alignItems: "center", gap: 6 }}>
          Marks
          <input type="number" min={0} max={max} value={feedback.marks} onChange={(e) => onChange({ ...feedback, marks: Number(e.target.value) })} style={{ ...fieldStyle, width: 60 }} />
          / {max}
        </label>
        <input type="text" placeholder="Feedback (optional)" value={feedback.comment} onChange={(e) => onChange({ ...feedback, comment: e.target.value })} style={{ ...fieldStyle, flex: 1, minWidth: 180 }} />
      </div>
    </div>
  );
}

// Teacher's grading surface for one learner's submission. Auto-gradable items are shown
// read-only (already scored server-side at submit time — see grading.utils.js); everything else
// — short-answer/unstructured/submission items and every rubric criterion — gets a marks +
// comment input here. Saving combines both into the release the learner sees.
export default function GradingPanel({ assessment, submission, onSave, isSaving }) {
  const items = useMemo(() => (assessment.items || []).map(normalizeLegacyItem), [assessment.items]);
  const rubric = assessment.rubric || [];
  const answersByItem = useMemo(() => new Map((submission.answers || []).map((a) => [a.itemId, a.response])), [submission.answers]);
  const autoByItem = useMemo(() => new Map((submission.autoItemResults || []).map((r) => [r.itemId, r])), [submission.autoItemResults]);

  const existingFeedback = useMemo(() => {
    const map = new Map((submission.itemFeedback || []).map((f) => [f.itemId, f]));
    return map;
  }, [submission.itemFeedback]);

  const [itemFeedback, setItemFeedback] = useState(() => {
    const map = new Map();
    items.filter((i) => !AUTO_GRADABLE_KINDS.includes(i.kind)).forEach((i) => {
      const existing = existingFeedback.get(i.id);
      map.set(i.id, { marks: existing?.marks ?? 0, comment: existing?.comment ?? "" });
    });
    rubric.forEach((c) => {
      const key = `rubric:${c.id}`;
      const existing = existingFeedback.get(key);
      map.set(key, { marks: existing?.marks ?? 0, comment: existing?.comment ?? "" });
    });
    return map;
  });
  const [overallFeedback, setOverallFeedback] = useState(submission.overallFeedback || "");

  const setFeedback = (itemId, feedback) => {
    const next = new Map(itemFeedback);
    next.set(itemId, feedback);
    setItemFeedback(next);
  };

  const autoItems = items.filter((i) => AUTO_GRADABLE_KINDS.includes(i.kind));
  const manualItems = items.filter((i) => !AUTO_GRADABLE_KINDS.includes(i.kind));

  const manualScore = [...itemFeedback.values()].reduce((sum, f) => sum + (Number(f.marks) || 0), 0);

  const handleSave = () => {
    const payload = [...itemFeedback.entries()].map(([itemId, f]) => ({ itemId, marks: f.marks, comment: f.comment }));
    onSave({ itemFeedback: payload, overallFeedback, manualScore });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {submission.autoMax > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Auto-graded · {submission.autoScore}/{submission.autoMax}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {autoItems.map((item, i) => (
              <AutoGradedRow key={item.id} index={i} item={item} response={answersByItem.get(item.id)} autoResult={autoByItem.get(item.id)} />
            ))}
          </div>
        </div>
      )}

      {manualItems.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Needs grading
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {manualItems.map((item, i) => (
              <ManualGradeRow
                key={item.id}
                index={autoItems.length + i}
                item={item}
                response={answersByItem.get(item.id)}
                feedback={itemFeedback.get(item.id) || { marks: 0, comment: "" }}
                onChange={(f) => setFeedback(item.id, f)}
              />
            ))}
          </div>
        </div>
      )}

      {rubric.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Rubric
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rubric.map((c) => (
              <RubricRow key={c.id} criterion={c} feedback={itemFeedback.get(`rubric:${c.id}`) || { marks: 0, comment: "" }} onChange={(f) => setFeedback(`rubric:${c.id}`, f)} />
            ))}
          </div>
        </div>
      )}

      <div>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>Overall Feedback</p>
        <textarea
          value={overallFeedback}
          onChange={(e) => setOverallFeedback(e.target.value)}
          placeholder="A note for the learner about their work overall…"
          style={{ ...fieldStyle, width: "100%", minHeight: 80, resize: "vertical" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 6, borderTop: `1px solid ${T.border}` }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>
          Total: {(submission.autoScore || 0) + manualScore} / {submission.maxScore}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={{ padding: "10px 22px", backgroundColor: isSaving ? "#b8d9ee" : T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isSaving ? "not-allowed" : "pointer" }}
        >
          {isSaving ? "Saving…" : "Save & Release Grade"}
        </button>
      </div>
    </div>
  );
}
