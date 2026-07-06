import { useState } from "react";
import {
  itemSchema, STRUCTURED_QUESTION_TYPES, UNSTRUCTURED_QUESTION_TYPES, MEDIA_RESPONSE_TYPES,
} from "../schemas/assessment.schema";
import { useAddItem, useUpdateItem } from "../hooks/useAssessment";
import { Editor as RichTextField } from "../../courses/components/RichTextEditor";
import { isEmptyHtml } from "../../courses/components/RichContent";

export const QUESTION_TYPE_LABELS = {
  mcq: "Multiple Choice", trueFalse: "True / False", matching: "Matching", fillBlank: "Fill in the Blank", ordering: "Ordering / Sequencing",
  shortAnswer: "Short Answer", essay: "Essay / Long Answer", fileUpload: "File / Document Upload", mediaResponse: "Audio / Video Response", linkSubmission: "Link / URL Submission",
};
const MEDIA_TYPE_LABELS = { audio: "Audio", video: "Video", either: "Audio or Video" };

const fieldStyle = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1.5px solid #E5E7EB",
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: "#F9FAFB",
  color: "#374151",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const selectStyle = {
  ...fieldStyle,
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  cursor: "pointer",
};

function Label({ children }) {
  return <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "5px" }}>{children}</label>;
}

function initialState(editTarget) {
  if (editTarget) {
    return {
      question: editTarget.question || "",
      questionType: editTarget.questionType || "mcq",
      options: editTarget.options?.length ? editTarget.options : ["", ""],
      correctAnswer: editTarget.correctAnswer || "",
      pairs: editTarget.pairs?.length ? editTarget.pairs : [{ left: "", right: "" }, { left: "", right: "" }],
      blanks: editTarget.blanks?.length ? editTarget.blanks : [""],
      sequence: editTarget.sequence?.length ? editTarget.sequence : ["", ""],
      acceptedFileTypes: editTarget.acceptedFileTypes || [],
      mediaType: editTarget.mediaType || "either",
      points: editTarget.points ?? 1,
    };
  }
  return {
    question: "", questionType: "mcq", options: ["", ""], correctAnswer: "",
    pairs: [{ left: "", right: "" }, { left: "", right: "" }], blanks: [""], sequence: ["", ""],
    acceptedFileTypes: [], mediaType: "either", points: 1,
  };
}

export default function QuestionModal({ assessmentId, editTarget, onClose }) {
  const { mutate: addItem, isPending: adding } = useAddItem();
  const { mutate: updateItem, isPending: updating } = useUpdateItem();
  const isPending = adding || updating;

  const [form, setForm] = useState(() => initialState(editTarget));
  const [error, setError] = useState("");

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setOption = (index, value) => {
    const options = [...form.options];
    options[index] = value;
    setField("options", options);
  };

  const addOption = () => setField("options", [...form.options, ""]);
  const removeOption = (index) => {
    const removed = form.options[index];
    const options = form.options.filter((_, i) => i !== index);
    setField("options", options);
    if (form.correctAnswer === removed) setField("correctAnswer", "");
  };

  const setPair = (index, side, value) => {
    const pairs = form.pairs.map((p, i) => (i === index ? { ...p, [side]: value } : p));
    setField("pairs", pairs);
  };
  const addPair = () => setField("pairs", [...form.pairs, { left: "", right: "" }]);
  const removePair = (index) => setField("pairs", form.pairs.filter((_, i) => i !== index));

  const setBlank = (index, value) => {
    const blanks = [...form.blanks];
    blanks[index] = value;
    setField("blanks", blanks);
  };
  const addBlank = () => setField("blanks", [...form.blanks, ""]);
  const removeBlank = (index) => setField("blanks", form.blanks.filter((_, i) => i !== index));

  const setStep = (index, value) => {
    const sequence = [...form.sequence];
    sequence[index] = value;
    setField("sequence", sequence);
  };
  const addStep = () => setField("sequence", [...form.sequence, ""]);
  const removeStep = (index) => setField("sequence", form.sequence.filter((_, i) => i !== index));
  const moveStep = (index, dir) => {
    const to = index + dir;
    if (to < 0 || to >= form.sequence.length) return;
    const sequence = [...form.sequence];
    [sequence[index], sequence[to]] = [sequence[to], sequence[index]];
    setField("sequence", sequence);
  };

  const [fileTypeInput, setFileTypeInput] = useState("");
  const addFileType = () => {
    const value = fileTypeInput.trim();
    if (!value || form.acceptedFileTypes.includes(value)) { setFileTypeInput(""); return; }
    setField("acceptedFileTypes", [...form.acceptedFileTypes, value]);
    setFileTypeInput("");
  };
  const removeFileType = (value) => setField("acceptedFileTypes", form.acceptedFileTypes.filter((t) => t !== value));

  const handleTypeChange = (questionType) => {
    setForm((f) => ({
      ...f,
      questionType,
      options: questionType === "mcq" ? (f.options.length >= 2 ? f.options : ["", ""]) : [],
      correctAnswer: "",
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (isEmptyHtml(form.question)) {
      setError("Question text is required");
      return;
    }

    const payload = {
      ...form,
      points: Number(form.points),
      options: form.questionType === "mcq" ? form.options.filter((o) => o.trim() !== "") : [],
      pairs: form.questionType === "matching" ? form.pairs.filter((p) => p.left.trim() && p.right.trim()) : [],
      blanks: form.questionType === "fillBlank" ? form.blanks.filter((b) => b.trim() !== "") : [],
      sequence: form.questionType === "ordering" ? form.sequence.filter((s) => s.trim() !== "") : [],
      acceptedFileTypes: form.questionType === "fileUpload" ? form.acceptedFileTypes : [],
    };

    const result = itemSchema.safeParse(payload);
    if (!result.success) {
      setError(result.error.issues[0]?.message || "Please check the question details");
      return;
    }

    if (editTarget) {
      updateItem({ assessmentId, itemId: editTarget.id, data: result.data }, { onSuccess: onClose });
    } else {
      addItem({ assessmentId, data: result.data }, { onSuccess: onClose });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
      <div style={{ background: "#F3F4F6", borderRadius: "16px", width: "100%", maxWidth: "580px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: "16px 16px 0 0", borderBottom: "1px solid #E5E7EB" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0F2645" }}>
            {editTarget ? "Edit Question" : "Add Question"}
          </h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        <form id="question-form" onSubmit={handleSubmit}>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {error && (
              <div style={{ padding: "10px 14px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "10px", color: "#EF4444", fontSize: "13px" }}>
                {error}
              </div>
            )}

            <div>
              <Label>Question *</Label>
              <RichTextField value={form.question} onChange={(html) => setField("question", html)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "12px" }}>
              <div>
                <Label>Question Type</Label>
                <select style={selectStyle} value={form.questionType} onChange={(e) => handleTypeChange(e.target.value)}>
                  <optgroup label="Structured">
                    {STRUCTURED_QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
                  </optgroup>
                  <optgroup label="Unstructured">
                    {UNSTRUCTURED_QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <Label>Points</Label>
                <input type="number" min="0" style={fieldStyle} value={form.points} onChange={(e) => setField("points", e.target.value)} />
              </div>
            </div>

            {form.questionType === "mcq" && (
              <div>
                <Label>Options — select the correct answer</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {form.options.map((option, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={form.correctAnswer !== "" && form.correctAnswer === option && option.trim() !== ""}
                        onChange={() => setField("correctAnswer", option)}
                        disabled={option.trim() === ""}
                      />
                      <input
                        style={fieldStyle}
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => {
                          const wasCorrect = form.correctAnswer === option;
                          setOption(index, e.target.value);
                          if (wasCorrect) setField("correctAnswer", e.target.value);
                        }}
                      />
                      {form.options.length > 2 && (
                        <button type="button" onClick={() => removeOption(index)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "18px", padding: "0 4px" }}>
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addOption} style={{ marginTop: "8px", background: "none", border: "none", color: "#38aae1", fontSize: "13px", fontWeight: "600", cursor: "pointer", padding: 0 }}>
                  + Add Option
                </button>
              </div>
            )}

            {form.questionType === "trueFalse" && (
              <div>
                <Label>Correct Answer</Label>
                <div style={{ display: "flex", gap: "16px" }}>
                  {["True", "False"].map((v) => (
                    <label key={v} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#374151" }}>
                      <input type="radio" name="correctAnswer" checked={form.correctAnswer === v} onChange={() => setField("correctAnswer", v)} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.questionType === "matching" && (
              <div>
                <Label>Pairs — match left to right</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {form.pairs.map((pair, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input style={fieldStyle} placeholder={`Left ${index + 1}`} value={pair.left} onChange={(e) => setPair(index, "left", e.target.value)} />
                      <span style={{ color: "#9CA3AF" }}>↔</span>
                      <input style={fieldStyle} placeholder={`Right ${index + 1}`} value={pair.right} onChange={(e) => setPair(index, "right", e.target.value)} />
                      {form.pairs.length > 2 && (
                        <button type="button" onClick={() => removePair(index)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "18px", padding: "0 4px" }}>×</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addPair} style={{ marginTop: "8px", background: "none", border: "none", color: "#38aae1", fontSize: "13px", fontWeight: "600", cursor: "pointer", padding: 0 }}>
                  + Add Pair
                </button>
              </div>
            )}

            {form.questionType === "fillBlank" && (
              <div>
                <Label>Blank Answers <span style={{ fontWeight: 400, color: "#9CA3AF" }}>— use ___ in the question text to mark each blank</span></Label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {form.blanks.map((blank, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input style={fieldStyle} placeholder={`Blank ${index + 1} answer`} value={blank} onChange={(e) => setBlank(index, e.target.value)} />
                      {form.blanks.length > 1 && (
                        <button type="button" onClick={() => removeBlank(index)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "18px", padding: "0 4px" }}>×</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addBlank} style={{ marginTop: "8px", background: "none", border: "none", color: "#38aae1", fontSize: "13px", fontWeight: "600", cursor: "pointer", padding: 0 }}>
                  + Add Blank
                </button>
              </div>
            )}

            {form.questionType === "ordering" && (
              <div>
                <Label>Steps — in the correct order</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {form.sequence.map((step, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#9CA3AF", width: "16px", flexShrink: 0 }}>{index + 1}.</span>
                      <input style={fieldStyle} placeholder={`Step ${index + 1}`} value={step} onChange={(e) => setStep(index, e.target.value)} />
                      <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} style={{ background: "none", border: "none", color: index === 0 ? "#E5E7EB" : "#9CA3AF", cursor: index === 0 ? "default" : "pointer", fontSize: "14px", padding: "0 2px" }}>↑</button>
                      <button type="button" onClick={() => moveStep(index, 1)} disabled={index === form.sequence.length - 1} style={{ background: "none", border: "none", color: index === form.sequence.length - 1 ? "#E5E7EB" : "#9CA3AF", cursor: index === form.sequence.length - 1 ? "default" : "pointer", fontSize: "14px", padding: "0 2px" }}>↓</button>
                      {form.sequence.length > 2 && (
                        <button type="button" onClick={() => removeStep(index)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "18px", padding: "0 4px" }}>×</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addStep} style={{ marginTop: "8px", background: "none", border: "none", color: "#38aae1", fontSize: "13px", fontWeight: "600", cursor: "pointer", padding: 0 }}>
                  + Add Step
                </button>
              </div>
            )}

            {form.questionType === "shortAnswer" && (
              <div>
                <Label>Model Answer (optional)</Label>
                <input style={fieldStyle} placeholder="Reference answer for grading" value={form.correctAnswer} onChange={(e) => setField("correctAnswer", e.target.value)} />
              </div>
            )}

            {form.questionType === "essay" && (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF", fontStyle: "italic" }}>
                Learners submit a free-form written response. Graded manually — no fixed answer.
              </p>
            )}

            {form.questionType === "fileUpload" && (
              <div>
                <Label>Accepted File Types <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span></Label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    style={fieldStyle} placeholder="e.g. .pdf, .docx" value={fileTypeInput}
                    onChange={(e) => setFileTypeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFileType(); } }}
                  />
                  <button type="button" onClick={addFileType} disabled={!fileTypeInput.trim()} style={{ padding: "0 16px", borderRadius: "10px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: "13px", fontWeight: "600", cursor: fileTypeInput.trim() ? "pointer" : "not-allowed", flexShrink: 0 }}>+ Add</button>
                </div>
                {form.acceptedFileTypes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginTop: "8px" }}>
                    {form.acceptedFileTypes.map((t) => (
                      <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "20px", border: "1px solid #a8d5ee", backgroundColor: "#e8f5fb", color: "#25476a", fontSize: "12px", fontWeight: "600" }}>
                        {t}
                        <button type="button" onClick={() => removeFileType(t)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: 0, color: "inherit" }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: "#9CA3AF", fontStyle: "italic" }}>Learner submits a document — graded manually.</p>
              </div>
            )}

            {form.questionType === "mediaResponse" && (
              <div>
                <Label>Response Format</Label>
                <select style={selectStyle} value={form.mediaType} onChange={(e) => setField("mediaType", e.target.value)}>
                  {MEDIA_RESPONSE_TYPES.map((t) => <option key={t} value={t}>{MEDIA_TYPE_LABELS[t]}</option>)}
                </select>
                <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: "#9CA3AF", fontStyle: "italic" }}>Learner submits an audio/video recording — graded manually.</p>
              </div>
            )}

            {form.questionType === "linkSubmission" && (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF", fontStyle: "italic" }}>
                Learner submits a link/URL (e.g. a shared doc, repo, or video). Graded manually — no fixed answer.
              </p>
            )}
          </div>

          <div style={{ padding: "16px 24px", display: "flex", gap: "10px", justifyContent: "flex-end", backgroundColor: "#fff", borderRadius: "0 0 16px 16px", borderTop: "1px solid #E5E7EB" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{ padding: "10px 24px", backgroundColor: isPending ? "#fef3d0" : "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
            >
              {isPending ? "Saving…" : editTarget ? "Save Changes" : "Add Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
