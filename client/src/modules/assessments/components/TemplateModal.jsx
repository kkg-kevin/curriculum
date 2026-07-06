import { useState } from "react";
import { useCreateTemplate, useUpdateTemplate } from "../hooks/useTemplates";
import {
  ASSESSMENT_TYPES,
  QUESTION_BASED_TYPES,
  TASK_BASED_TYPES,
  OBSERVATION_BASED_TYPES,
  STRUCTURED_QUESTION_TYPES,
  UNSTRUCTURED_QUESTION_TYPES,
  MEDIA_RESPONSE_TYPES,
  DEFAULT_RATING_SCALE,
} from "../schemas/assessment.schema";
import { QUESTION_TYPE_LABELS } from "./QuestionModal";

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", project: "Project", assignment: "Assignment", observation: "Teacher Observation" };
const MEDIA_TYPE_LABELS = { audio: "Audio", video: "Video", either: "Audio or Video" };

const fieldStyle = {
  padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13.5px",
  fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none",
  width: "100%", boxSizing: "border-box",
};
const selectStyle = { ...fieldStyle, cursor: "pointer" };

function Label({ children }) {
  return <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>{children}</label>;
}

function RemovableRow({ children, onRemove }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", backgroundColor: "#fff", border: "1px solid #EEF0F2", borderRadius: "9px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <button type="button" onClick={onRemove} title="Remove" style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
    </div>
  );
}

/* ── Items editor (Quiz / Exam) ───────────────────────────────────────── */

function itemSummaryDetail(item) {
  if (item.questionType === "mcq") return item.options?.length ? ` · ${item.options.length} options` : "";
  if (item.questionType === "matching") return ` · ${item.pairs?.length || 0} pairs`;
  if (item.questionType === "fillBlank") return ` · ${item.blanks?.length || 0} blank${item.blanks?.length !== 1 ? "s" : ""}`;
  if (item.questionType === "ordering") return ` · ${item.sequence?.length || 0} steps`;
  if (item.questionType === "fileUpload") return item.acceptedFileTypes?.length ? ` · ${item.acceptedFileTypes.join(", ")}` : "";
  if (item.questionType === "mediaResponse") return ` · ${MEDIA_TYPE_LABELS[item.mediaType] || item.mediaType}`;
  return "";
}

function isItemValid(questionType, state) {
  if (questionType === "mcq") return state.options.length >= 2;
  if (questionType === "matching") return state.pairs.filter((p) => p.left.trim() && p.right.trim()).length >= 2;
  if (questionType === "fillBlank") return state.blanks.some((b) => b.trim());
  if (questionType === "ordering") return state.sequence.filter((s) => s.trim()).length >= 2;
  return true;
}

function ItemsEditor({ items, setItems }) {
  const [question, setQuestion] = useState("");
  const [questionType, setQuestionType] = useState("mcq");
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState([]);
  const [optionInput, setOptionInput] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [pairs, setPairs] = useState([{ left: "", right: "" }, { left: "", right: "" }]);
  const [blanks, setBlanks] = useState([""]);
  const [sequence, setSequence] = useState(["", ""]);
  const [acceptedFileTypes, setAcceptedFileTypes] = useState([]);
  const [fileTypeInput, setFileTypeInput] = useState("");
  const [mediaType, setMediaType] = useState("either");

  const resetForm = () => {
    setQuestion(""); setQuestionType("mcq"); setPoints(1);
    setOptions([]); setOptionInput(""); setCorrectAnswer("");
    setPairs([{ left: "", right: "" }, { left: "", right: "" }]);
    setBlanks([""]); setSequence(["", ""]);
    setAcceptedFileTypes([]); setFileTypeInput(""); setMediaType("either");
  };

  const addOption = () => {
    const value = optionInput.trim();
    if (!value || options.includes(value)) { setOptionInput(""); return; }
    setOptions((prev) => [...prev, value]);
    setOptionInput("");
  };

  const setPairSide = (index, side, value) => setPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [side]: value } : p)));
  const addPair = () => setPairs((prev) => [...prev, { left: "", right: "" }]);
  const removePair = (index) => setPairs((prev) => prev.filter((_, i) => i !== index));

  const setBlankAt = (index, value) => setBlanks((prev) => prev.map((b, i) => (i === index ? value : b)));
  const addBlank = () => setBlanks((prev) => [...prev, ""]);
  const removeBlank = (index) => setBlanks((prev) => prev.filter((_, i) => i !== index));

  const setStepAt = (index, value) => setSequence((prev) => prev.map((s, i) => (i === index ? value : s)));
  const addStep = () => setSequence((prev) => [...prev, ""]);
  const removeStep = (index) => setSequence((prev) => prev.filter((_, i) => i !== index));
  const moveStep = (index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= sequence.length) return;
    setSequence((prev) => {
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const addFileType = () => {
    const value = fileTypeInput.trim();
    if (!value || acceptedFileTypes.includes(value)) { setFileTypeInput(""); return; }
    setAcceptedFileTypes((prev) => [...prev, value]);
    setFileTypeInput("");
  };
  const removeFileType = (value) => setAcceptedFileTypes((prev) => prev.filter((t) => t !== value));

  const state = { options, pairs, blanks, sequence };
  const valid = question.trim() && isItemValid(questionType, state);

  const addItem = () => {
    if (!valid) return;
    setItems((prev) => [...prev, {
      question: question.trim(), questionType, points: Number(points) || 0,
      options: questionType === "mcq" ? options : [],
      correctAnswer: ["mcq", "trueFalse", "shortAnswer"].includes(questionType) ? correctAnswer : "",
      pairs: questionType === "matching" ? pairs.filter((p) => p.left.trim() && p.right.trim()) : [],
      blanks: questionType === "fillBlank" ? blanks.filter((b) => b.trim()) : [],
      sequence: questionType === "ordering" ? sequence.filter((s) => s.trim()) : [],
      acceptedFileTypes: questionType === "fileUpload" ? acceptedFileTypes : [],
      mediaType: questionType === "mediaResponse" ? mediaType : "either",
    }]);
    resetForm();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((item, idx) => (
            <RemovableRow key={idx} onRemove={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
              <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: "600", color: "#111827" }}>{idx + 1}. {item.question}</p>
              <span style={{ fontSize: "11px", color: "#6B7280" }}>{QUESTION_TYPE_LABELS[item.questionType]} · {item.points} pts{itemSummaryDetail(item)}</span>
            </RemovableRow>
          ))}
        </div>
      )}

      <div style={{ padding: "12px", backgroundColor: "#F9FAFB", border: "1.5px dashed #E5E7EB", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <input style={fieldStyle} placeholder="Question text" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "8px" }}>
          <select style={selectStyle} value={questionType} onChange={(e) => { setQuestionType(e.target.value); setCorrectAnswer(""); }}>
            <optgroup label="Structured">
              {STRUCTURED_QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
            </optgroup>
            <optgroup label="Unstructured">
              {UNSTRUCTURED_QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
            </optgroup>
          </select>
          <input type="number" min="0" style={fieldStyle} value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Points" />
        </div>

        {questionType === "mcq" && (
          <div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input style={fieldStyle} placeholder="Add an option" value={optionInput} onChange={(e) => setOptionInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }} />
              <button type="button" onClick={addOption} disabled={!optionInput.trim()} style={{ padding: "0 14px", borderRadius: "9px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: "12.5px", fontWeight: "600", cursor: optionInput.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}>+ Add</button>
            </div>
            {options.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {options.map((o) => (
                  <button
                    key={o} type="button" onClick={() => setCorrectAnswer(o)}
                    title="Click to mark as correct answer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 8px 4px 10px", borderRadius: "20px",
                      border: `1.5px solid ${correctAnswer === o ? "#25476a" : "#E5E7EB"}`, backgroundColor: correctAnswer === o ? "#e8f5fb" : "#fff",
                      color: correctAnswer === o ? "#25476a" : "#374151", fontSize: "11.5px", fontWeight: "600", cursor: "pointer",
                    }}
                  >
                    {correctAnswer === o && "✓"} {o}
                    <span
                      role="button" tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); setOptions((prev) => prev.filter((x) => x !== o)); if (correctAnswer === o) setCorrectAnswer(""); }}
                      style={{ cursor: "pointer" }}
                    >×</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {questionType === "trueFalse" && (
          <div style={{ display: "flex", gap: "14px" }}>
            {["True", "False"].map((v) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#374151" }}>
                <input type="radio" name="tpl-tf" checked={correctAnswer === v} onChange={() => setCorrectAnswer(v)} /> {v}
              </label>
            ))}
          </div>
        )}
        {questionType === "matching" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {pairs.map((pair, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input style={fieldStyle} placeholder={`Left ${index + 1}`} value={pair.left} onChange={(e) => setPairSide(index, "left", e.target.value)} />
                  <span style={{ color: "#9CA3AF", fontSize: "12px" }}>↔</span>
                  <input style={fieldStyle} placeholder={`Right ${index + 1}`} value={pair.right} onChange={(e) => setPairSide(index, "right", e.target.value)} />
                  {pairs.length > 2 && (
                    <button type="button" onClick={() => removePair(index)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "16px", padding: "0 2px" }}>×</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addPair} style={{ marginTop: "6px", background: "none", border: "none", color: "#25476a", fontSize: "12px", fontWeight: "700", cursor: "pointer", padding: 0 }}>+ Add Pair</button>
          </div>
        )}
        {questionType === "fillBlank" && (
          <div>
            <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#9CA3AF" }}>Use ___ in the question text to mark each blank</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {blanks.map((blank, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input style={fieldStyle} placeholder={`Blank ${index + 1} answer`} value={blank} onChange={(e) => setBlankAt(index, e.target.value)} />
                  {blanks.length > 1 && (
                    <button type="button" onClick={() => removeBlank(index)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "16px", padding: "0 2px" }}>×</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addBlank} style={{ marginTop: "6px", background: "none", border: "none", color: "#25476a", fontSize: "12px", fontWeight: "700", cursor: "pointer", padding: 0 }}>+ Add Blank</button>
          </div>
        )}
        {questionType === "ordering" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {sequence.map((step, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#9CA3AF", width: "14px", flexShrink: 0 }}>{index + 1}.</span>
                  <input style={fieldStyle} placeholder={`Step ${index + 1}`} value={step} onChange={(e) => setStepAt(index, e.target.value)} />
                  <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} style={{ background: "none", border: "none", color: index === 0 ? "#E5E7EB" : "#9CA3AF", cursor: index === 0 ? "default" : "pointer", fontSize: "13px", padding: "0 1px" }}>↑</button>
                  <button type="button" onClick={() => moveStep(index, 1)} disabled={index === sequence.length - 1} style={{ background: "none", border: "none", color: index === sequence.length - 1 ? "#E5E7EB" : "#9CA3AF", cursor: index === sequence.length - 1 ? "default" : "pointer", fontSize: "13px", padding: "0 1px" }}>↓</button>
                  {sequence.length > 2 && (
                    <button type="button" onClick={() => removeStep(index)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "16px", padding: "0 2px" }}>×</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addStep} style={{ marginTop: "6px", background: "none", border: "none", color: "#25476a", fontSize: "12px", fontWeight: "700", cursor: "pointer", padding: 0 }}>+ Add Step</button>
          </div>
        )}
        {questionType === "shortAnswer" && (
          <input style={fieldStyle} placeholder="Model answer (optional)" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
        )}
        {questionType === "essay" && (
          <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>Free-form written response — graded manually.</p>
        )}
        {questionType === "fileUpload" && (
          <div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input style={fieldStyle} placeholder="Accepted file types, e.g. .pdf" value={fileTypeInput} onChange={(e) => setFileTypeInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFileType(); } }} />
              <button type="button" onClick={addFileType} disabled={!fileTypeInput.trim()} style={{ padding: "0 14px", borderRadius: "9px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: "12.5px", fontWeight: "600", cursor: fileTypeInput.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}>+ Add</button>
            </div>
            {acceptedFileTypes.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {acceptedFileTypes.map((t) => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 8px", borderRadius: "20px", border: "1px solid #a8d5ee", backgroundColor: "#e8f5fb", color: "#25476a", fontSize: "11.5px", fontWeight: "600" }}>
                    {t}
                    <span role="button" tabIndex={-1} onClick={() => removeFileType(t)} style={{ cursor: "pointer" }}>×</span>
                  </span>
                ))}
              </div>
            )}
            <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>Learner submits a document — graded manually.</p>
          </div>
        )}
        {questionType === "mediaResponse" && (
          <div>
            <select style={selectStyle} value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
              {MEDIA_RESPONSE_TYPES.map((t) => <option key={t} value={t}>{MEDIA_TYPE_LABELS[t]}</option>)}
            </select>
            <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>Learner submits an audio/video recording — graded manually.</p>
          </div>
        )}
        {questionType === "linkSubmission" && (
          <p style={{ margin: 0, fontSize: "11.5px", color: "#9CA3AF", fontStyle: "italic" }}>Learner submits a link/URL — graded manually.</p>
        )}

        <button
          type="button" onClick={addItem}
          disabled={!valid}
          style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: "9px", border: "none", backgroundColor: "#25476a", color: "#fff", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", opacity: valid ? 1 : 0.5 }}
        >
          + Add Question to Template
        </button>
      </div>
    </div>
  );
}

/* ── Rubric editor (Assignment / Project) ────────────────────────────── */

function RubricEditor({ rubric, setRubric }) {
  const [criterion, setCriterion] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(10);

  const addCriterion = () => {
    if (!criterion.trim()) return;
    setRubric((prev) => [...prev, { criterion: criterion.trim(), description: description.trim(), points: Number(points) || 0 }]);
    setCriterion(""); setDescription(""); setPoints(10);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {rubric.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {rubric.map((c, idx) => (
            <RemovableRow key={idx} onRemove={() => setRubric((prev) => prev.filter((_, i) => i !== idx))}>
              <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: "600", color: "#111827" }}>{c.criterion} <span style={{ fontWeight: 400, color: "#6B7280" }}>· {c.points} pts</span></p>
              {c.description && <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{c.description}</p>}
            </RemovableRow>
          ))}
        </div>
      )}

      <div style={{ padding: "12px", backgroundColor: "#F9FAFB", border: "1.5px dashed #E5E7EB", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <input style={fieldStyle} placeholder="Criterion (e.g. Clarity of argument)" value={criterion} onChange={(e) => setCriterion(e.target.value)} />
        <textarea rows={2} style={{ ...fieldStyle, resize: "vertical" }} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input type="number" min="0" style={{ ...fieldStyle, width: "120px" }} placeholder="Points" value={points} onChange={(e) => setPoints(e.target.value)} />
        <button
          type="button" onClick={addCriterion} disabled={!criterion.trim()}
          style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: "9px", border: "none", backgroundColor: "#25476a", color: "#fff", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", opacity: criterion.trim() ? 1 : 0.5 }}
        >
          + Add Criterion to Template
        </button>
      </div>
    </div>
  );
}

/* ── Indicators editor (Teacher Observation) ─────────────────────────── */

function IndicatorsEditor({ indicators, setIndicators }) {
  const [text, setText] = useState("");
  const [ratingScale, setRatingScale] = useState(DEFAULT_RATING_SCALE);
  const [ratingInput, setRatingInput] = useState("");

  const addRating = () => {
    const value = ratingInput.trim();
    if (!value || ratingScale.includes(value)) { setRatingInput(""); return; }
    setRatingScale((prev) => [...prev, value]);
    setRatingInput("");
  };

  const addIndicator = () => {
    if (!text.trim() || ratingScale.length < 2) return;
    setIndicators((prev) => [...prev, { text: text.trim(), ratingScale }]);
    setText(""); setRatingScale(DEFAULT_RATING_SCALE); setRatingInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {indicators.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {indicators.map((ind, idx) => (
            <RemovableRow key={idx} onRemove={() => setIndicators((prev) => prev.filter((_, i) => i !== idx))}>
              <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "600", color: "#111827" }}>{ind.text}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {ind.ratingScale.map((r) => (
                  <span key={r} style={{ fontSize: "10.5px", fontWeight: "700", color: "#25476a", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", borderRadius: "20px", padding: "1px 7px" }}>{r}</span>
                ))}
              </div>
            </RemovableRow>
          ))}
        </div>
      )}

      <div style={{ padding: "12px", backgroundColor: "#F9FAFB", border: "1.5px dashed #E5E7EB", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <input style={fieldStyle} placeholder="Indicator (e.g. Follows multi-step instructions)" value={text} onChange={(e) => setText(e.target.value)} />
        <div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input style={fieldStyle} placeholder="Add a rating level" value={ratingInput} onChange={(e) => setRatingInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRating(); } }} />
            <button type="button" onClick={addRating} disabled={!ratingInput.trim()} style={{ padding: "0 14px", borderRadius: "9px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: "12.5px", fontWeight: "600", cursor: ratingInput.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}>+ Add</button>
          </div>
          {ratingScale.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
              {ratingScale.map((r) => (
                <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 7px 3px 10px", borderRadius: "20px", border: "1.5px solid #a8d5ee", backgroundColor: "#e8f5fb", color: "#25476a", fontSize: "11.5px", fontWeight: "600" }}>
                  {r}
                  <span role="button" tabIndex={-1} onClick={() => setRatingScale((prev) => prev.filter((x) => x !== r))} style={{ cursor: "pointer" }}>×</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button" onClick={addIndicator} disabled={!text.trim() || ratingScale.length < 2}
          style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: "9px", border: "none", backgroundColor: "#25476a", color: "#fff", fontSize: "12.5px", fontWeight: "700", cursor: "pointer", opacity: (!text.trim() || ratingScale.length < 2) ? 0.5 : 1 }}
        >
          + Add Indicator to Template
        </button>
      </div>
    </div>
  );
}

/* ── Main modal ───────────────────────────────────────────────────────── */

export default function TemplateModal({ editTarget, defaultType, onClose }) {
  const { mutate: createTemplate, isPending: creating } = useCreateTemplate();
  const { mutate: updateTemplate, isPending: updating } = useUpdateTemplate();
  const isPending = creating || updating;

  const [name, setName] = useState(editTarget?.name || "");
  const [type, setType] = useState(editTarget?.type || defaultType || ASSESSMENT_TYPES[0]);
  const [description, setDescription] = useState(editTarget?.description || "");
  const [instructions, setInstructions] = useState(editTarget?.instructions || "");
  const [items, setItems] = useState(editTarget?.items || []);
  const [rubric, setRubric] = useState(editTarget?.rubric || []);
  const [indicators, setIndicators] = useState(editTarget?.indicators || []);
  const [error, setError] = useState("");

  const isQuestionBased = QUESTION_BASED_TYPES.includes(type);
  const isTaskBased = TASK_BASED_TYPES.includes(type);
  const isObservationBased = OBSERVATION_BASED_TYPES.includes(type);

  const submit = () => {
    if (!name.trim()) { setError("Template name is required"); return; }
    setError("");
    const data = {
      name: name.trim(), type, description: description.trim(), instructions: instructions.trim(),
      items: isQuestionBased ? items : [],
      rubric: isTaskBased ? rubric : [],
      indicators: isObservationBased ? indicators : [],
    };
    const onSuccess = () => onClose();
    if (editTarget) updateTemplate({ id: editTarget.id, data }, { onSuccess });
    else createTemplate(data, { onSuccess });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "620px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#fff" }}>{editTarget ? "Edit Template" : "New Assessment Template"}</h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Reusable starting point — applying it copies this content into a new assessment</p>
        </div>

        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "60vh", overflowY: "auto" }}>
          {error && (
            <div style={{ padding: "9px 12px", background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "9px", color: "#EF4444", fontSize: "12.5px" }}>{error}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: "10px" }}>
            <div>
              <Label>Name *</Label>
              <input style={fieldStyle} placeholder="e.g. Basic Quiz Starter" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Type *</Label>
              <select style={selectStyle} value={type} onChange={(e) => setType(e.target.value)}>
                {ASSESSMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <textarea rows={2} style={{ ...fieldStyle, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <Label>Default Instructions</Label>
            <textarea rows={3} style={{ ...fieldStyle, resize: "vertical" }} placeholder="Shown to learners when using this template" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>

          <div>
            <Label>{isQuestionBased ? "Questions" : isTaskBased ? "Rubric Criteria" : "Indicators"}</Label>
            {isQuestionBased && <ItemsEditor items={items} setItems={setItems} />}
            {isTaskBased && <RubricEditor rubric={rubric} setRubric={setRubric} />}
            {isObservationBased && <IndicatorsEditor indicators={indicators} setIndicators={setIndicators} />}
          </div>
        </div>

        <div style={{ padding: "14px 22px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 16px", background: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Cancel</button>
          <button
            type="button" onClick={submit} disabled={isPending}
            style={{ padding: "9px 18px", background: isPending ? "#fde3b0" : "#feb139", color: "#25476a", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Saving…" : editTarget ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
