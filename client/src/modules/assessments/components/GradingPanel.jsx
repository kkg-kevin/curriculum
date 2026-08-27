import { useMemo, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { normalizeLegacyItem, entryMarks } from "../schemas/assessment.schema";
import { useAssessmentCompetencies } from "../hooks/useAssessment";
import RichContent from "./RichContent";

const T = { accent: "#25476a", accentLight: "#38aae1", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const AUTO_GRADABLE_KINDS = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank"];
const OBSERVATION_KIND_LABELS = { checklist: "Checklist", rating: "Rating", practicalSkill: "Practical Skill", behaviour: "Behaviour", note: "Note" };

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
  // File-upload items and project deliverables store {url, filename, mimeType, size} — every
  // other kind stores a string or string[] (see grading.utils.js's response contract).
  if (typeof response === "object" && response.url) {
    return <a href={response.url} target="_blank" rel="noopener noreferrer" style={{ color: T.accent, fontWeight: 600 }}>{response.filename || "View uploaded file"}</a>;
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
        <span style={{ fontSize: 11, fontWeight: 700, color: correct ? "#059669" : "#DC2626", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
          {correct ? <><FiCheck size={12} /> Correct</> : <><FiX size={12} /> Incorrect</>} · {autoResult?.marksAwarded ?? 0}/{autoResult?.maxMarks ?? entryMarks(item)}
        </span>
      </div>
      <p style={{ margin: "0 0 0 20px", fontSize: 12.5, color: T.inkMuted }}>Answer: {formatResponse(response)}</p>
    </div>
  );
}

// A question's rubric, shown as a checklist during grading — checking a criterion adds its
// points to the marks awarded. Replaces the flat number input entirely for entries authored
// with scoringCriteria (see ScoringCriteriaEditor in AssessmentBuilderPage.jsx); the checked
// total is written straight into feedback.marks, so it flows through the exact same
// itemFeedback/computeIndicatorBreakdown pipeline every other manually-graded entry already uses.
function ScoringCriteriaChecklist({ criteria, checkedIds, onToggle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {criteria.map((c) => {
        const checked = checkedIds.includes(c.id);
        return (
          <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.ink, cursor: "pointer" }}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(c.id)} />
            <span style={{ flex: 1 }}>{c.label}</span>
            <span style={{ fontSize: 11, color: T.inkFaint, fontWeight: 600 }}>{c.points} pt{c.points !== 1 ? "s" : ""}</span>
          </label>
        );
      })}
    </div>
  );
}

// Splits an earned total evenly across every indicator tagged to an entry — e.g. a 10pt rubric
// with 2 tagged indicators, scored 8, gives each indicator 4 earned marks. Written into
// feedback.indicatorMarks so grading.utils.js's computeIndicatorBreakdown uses this exact split
// instead of falling back to apportioning by each indicator's pre-set weight (its default
// behaviour when a manual entry carries no per-indicator feedback at all).
function evenIndicatorSplit(taggedIndicators, earnedTotal) {
  if (taggedIndicators.length === 0) return [];
  const share = Math.round((earnedTotal / taggedIndicators.length) * 100) / 100;
  return taggedIndicators.map(({ indicatorId }) => ({ indicatorId, marks: share }));
}

// An entry's marks input — either a checklist rubric (when scoringCriteria was authored for the
// question) or one flat "Marks" field. When tagged to two or more competency indicators, the
// earned total is split evenly across them (see evenIndicatorSplit) and written to
// feedback.indicatorMarks so the competency breakdown reflects actual performance on this entry
// rather than each indicator's pre-set authoring weight. A single tagged indicator earns the
// entry's full marks, same as before. Tagged indicators are named below for context either way.
function MarksInputs({ entry, feedback, indicatorNameById, onChange }) {
  const max = entryMarks(entry);
  const taggedIndicators = entry.indicatorMarks || [];
  const scoringCriteria = entry.scoringCriteria || [];

  const applyMarks = (marks) => {
    const indicatorMarks = taggedIndicators.length > 1 ? evenIndicatorSplit(taggedIndicators, marks) : [];
    onChange({ ...feedback, marks, indicatorMarks });
  };

  const toggleCriterion = (criterionId) => {
    const checkedIds = feedback.checkedCriteriaIds || [];
    const nextChecked = checkedIds.includes(criterionId) ? checkedIds.filter((id) => id !== criterionId) : [...checkedIds, criterionId];
    const marks = scoringCriteria.filter((c) => nextChecked.includes(c.id)).reduce((sum, c) => sum + (Number(c.points) || 0), 0);
    const indicatorMarks = taggedIndicators.length > 1 ? evenIndicatorSplit(taggedIndicators, marks) : [];
    onChange({ ...feedback, marks, checkedCriteriaIds: nextChecked, indicatorMarks });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {scoringCriteria.length > 0 ? (
        <>
          <p style={{ margin: "0 0 2px", fontSize: 12, color: T.inkMuted, fontWeight: 600 }}>Rubric</p>
          <ScoringCriteriaChecklist criteria={scoringCriteria} checkedIds={feedback.checkedCriteriaIds || []} onToggle={toggleCriterion} />
          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>Marks: {feedback.marks} / {max}</p>
        </>
      ) : (
        <label style={{ fontSize: 12, color: T.inkMuted, display: "flex", alignItems: "center", gap: 6 }}>
          Marks
          <input type="number" min={0} max={max} value={feedback.marks} onChange={(e) => applyMarks(Math.min(max, Math.max(0, Number(e.target.value) || 0)))} style={{ ...fieldStyle, width: 60 }} />
          / {max}
        </label>
      )}
      {taggedIndicators.length > 0 && (
        <p style={{ margin: 0, fontSize: 10.5, color: T.inkFaint }}>
          Also assesses: {taggedIndicators.map(({ indicatorId }) => indicatorNameById.get(indicatorId)?.name || "Indicator").join(", ")}
        </p>
      )}
    </div>
  );
}

function ManualGradeRow({ index, item, response, feedback, indicatorNameById, onChange }) {
  return (
    <div style={{ padding: "14px 16px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{index + 1}.</span>
        <div style={{ flex: 1, fontSize: 13 }}><RichContent html={item.question} /></div>
      </div>
      <p style={{ margin: "0 0 0 20px", fontSize: 12.5, color: T.ink, backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
        {formatResponse(response)}
      </p>
      <div style={{ marginLeft: 20 }}>
        <MarksInputs entry={item} feedback={feedback} indicatorNameById={indicatorNameById} onChange={onChange} />
      </div>
    </div>
  );
}

// Read-only — a project's deliverables carry no marks field of their own (see
// assessment.validation.js's deliverableSchema); a project is scored entirely through its
// rubric (see the Rubric section below), so this just surfaces what the learner attached
// while the teacher scores that rubric.
function DeliverableRow({ index, deliverable, response }) {
  return (
    <div style={{ padding: "14px 16px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{index + 1}.</span>
        <div style={{ flex: 1, fontSize: 13 }}>
          <p style={{ margin: 0, fontWeight: 700, color: T.ink }}>{deliverable.name}</p>
          {deliverable.description && <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{deliverable.description}</p>}
        </div>
      </div>
      <p style={{ margin: "0 0 0 20px", fontSize: 12.5, color: T.ink, backgroundColor: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px" }}>
        {formatResponse(response)}
      </p>
    </div>
  );
}

function RubricRow({ criterion, feedback, indicatorNameById, onChange }) {
  return (
    <div style={{ padding: "14px 16px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{criterion.criterion}</p>
      {criterion.description && <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>{criterion.description}</p>}
      <MarksInputs entry={criterion} feedback={feedback} indicatorNameById={indicatorNameById} onChange={onChange} />
    </div>
  );
}

// A Teacher Observation indicator — no learner response to show (it's the teacher's own direct
// judgment, not something a learner submitted), so this shows the indicator's own text/kind/
// rating-scale context instead of a response line, then the same shared MarksInputs every other
// scored entry uses.
function ObservationRow({ index, indicator, feedback, indicatorNameById, onChange }) {
  return (
    <div style={{ padding: "14px 16px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{index + 1}.</span>
        <div style={{ flex: 1, fontSize: 13 }}><RichContent html={indicator.text} /></div>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.accentLight, backgroundColor: `${T.accentLight}15`, border: `1px solid ${T.accentLight}35`, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
          {OBSERVATION_KIND_LABELS[indicator.kind] || indicator.kind}
        </span>
      </div>
      {indicator.ratingScale?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginLeft: 20 }}>
          {indicator.ratingScale.map((r) => (
            <span key={r} style={{ fontSize: 10.5, fontWeight: 700, color: T.accent, backgroundColor: `${T.accent}12`, border: `1px solid ${T.accent}35`, borderRadius: 20, padding: "2px 8px" }}>{r}</span>
          ))}
        </div>
      )}
      <div style={{ marginLeft: 20 }}>
        <MarksInputs entry={indicator} feedback={feedback} indicatorNameById={indicatorNameById} onChange={onChange} />
      </div>
    </div>
  );
}

// A "note"-kind observation indicator is a freeform comment, not a judgment — read-only here,
// same reasoning as DeliverableRow (nothing to score, just something to see).
function ObservationNoteRow({ index, indicator }) {
  return (
    <div style={{ padding: "14px 16px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{index + 1}.</span>
      <div style={{ flex: 1, fontSize: 13 }}><RichContent html={indicator.text} /></div>
    </div>
  );
}

// Teacher's grading surface for one learner's submission. Auto-gradable items are shown
// read-only (already scored server-side at submit time — see grading.utils.js); everything else
// — short-answer/unstructured/submission items and every rubric criterion — gets a marks input
// here. Feedback is deliberately only the single Overall Feedback field below, not per-question —
// that one note is what the learner/guardian sees, and what feeds into the course report.
export default function GradingPanel({ assessment, submission, onSave, isSaving }) {
  const items = useMemo(() => (assessment.items || []).map(normalizeLegacyItem), [assessment.items]);
  const rubric = assessment.rubric || [];
  const deliverables = assessment.deliverables || [];
  // Teacher Observation scores through its own `indicators` array instead of `items` — a
  // "note"-kind indicator is a freeform comment (no judgment to score), so it's split out and
  // shown read-only instead. `items`/`rubric`/`deliverables` are always empty for this type, so
  // this is purely additive — nothing above changes for any other assessment type.
  const isObservation = assessment.type === "observation";
  const indicators = assessment.indicators || [];
  const scorableIndicators = isObservation ? indicators.filter((i) => i.kind !== "note") : [];
  const noteIndicators = isObservation ? indicators.filter((i) => i.kind === "note") : [];
  const answersByItem = useMemo(() => new Map((submission.answers || []).map((a) => [a.itemId, a.response])), [submission.answers]);
  const autoByItem = useMemo(() => new Map((submission.autoItemResults || []).map((r) => [r.itemId, r])), [submission.autoItemResults]);

  // Resolves indicatorMarks' bare indicatorIds to a display name — same competencies already
  // tagged onto this assessment via IndicatorPicker at authoring time.
  const { data: linkedCompetencies = [] } = useAssessmentCompetencies(assessment.id);
  const indicatorNameById = useMemo(() => {
    const map = new Map();
    linkedCompetencies.forEach((comp) => (comp.indicators || []).forEach((ind) => map.set(ind.id, { name: ind.name, competencyName: comp.name })));
    return map;
  }, [linkedCompetencies]);

  const existingFeedback = useMemo(() => {
    const map = new Map((submission.itemFeedback || []).map((f) => [f.itemId, f]));
    return map;
  }, [submission.itemFeedback]);

  // One marks slot per manually-graded item/rubric criterion — feedback is deliberately only
  // ever the single Overall Feedback field below, not per-question, so there's nothing to
  // populate for auto-graded items here at all.
  const [itemFeedback, setItemFeedback] = useState(() => {
    const map = new Map();
    items.filter((i) => !AUTO_GRADABLE_KINDS.includes(i.kind)).forEach((i) => {
      const existing = existingFeedback.get(i.id);
      map.set(i.id, { marks: existing?.marks ?? 0, checkedCriteriaIds: existing?.checkedCriteriaIds ?? [], indicatorMarks: existing?.indicatorMarks ?? [] });
    });
    rubric.forEach((c) => {
      const key = `rubric:${c.id}`;
      const existing = existingFeedback.get(key);
      map.set(key, { marks: existing?.marks ?? 0, checkedCriteriaIds: existing?.checkedCriteriaIds ?? [], indicatorMarks: existing?.indicatorMarks ?? [] });
    });
    scorableIndicators.forEach((ind) => {
      const existing = existingFeedback.get(ind.id);
      map.set(ind.id, { marks: existing?.marks ?? 0, checkedCriteriaIds: existing?.checkedCriteriaIds ?? [], indicatorMarks: existing?.indicatorMarks ?? [] });
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
    const payload = [...itemFeedback.entries()].map(([itemId, f]) => ({ itemId, marks: f.marks, checkedCriteriaIds: f.checkedCriteriaIds || [], indicatorMarks: f.indicatorMarks || [] }));
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

      {(manualItems.length > 0 || scorableIndicators.length > 0) && (
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
                feedback={itemFeedback.get(item.id) || { marks: 0 }}
                indicatorNameById={indicatorNameById}
                onChange={(f) => setFeedback(item.id, f)}
              />
            ))}
            {scorableIndicators.map((ind, i) => (
              <ObservationRow
                key={ind.id}
                index={i}
                indicator={ind}
                feedback={itemFeedback.get(ind.id) || { marks: 0 }}
                indicatorNameById={indicatorNameById}
                onChange={(f) => setFeedback(ind.id, f)}
              />
            ))}
          </div>
        </div>
      )}

      {noteIndicators.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Observation Notes
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {noteIndicators.map((ind, i) => <ObservationNoteRow key={ind.id} index={i} indicator={ind} />)}
          </div>
        </div>
      )}

      {deliverables.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Submitted Deliverables
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {deliverables.map((d, i) => (
              <DeliverableRow key={d.id} index={i} deliverable={d} response={answersByItem.get(d.id)} />
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
              <RubricRow key={c.id} criterion={c} feedback={itemFeedback.get(`rubric:${c.id}`) || { marks: 0 }} indicatorNameById={indicatorNameById} onChange={(f) => setFeedback(`rubric:${c.id}`, f)} />
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
          {isSaving ? "Saving…" : submission.classId ? "Save Grade" : "Save & Release Grade"}
        </button>
      </div>
    </div>
  );
}
