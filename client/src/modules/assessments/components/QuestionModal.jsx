import { useState } from "react";
import { itemSchema, QUESTION_TYPES } from "../schemas/assessment.schema";
import { useAddItem, useUpdateItem } from "../hooks/useAssessment";
import { Editor as RichTextField } from "../../courses/components/RichTextEditor";
import { isEmptyHtml } from "../../courses/components/RichContent";

const QUESTION_TYPE_LABELS = { mcq: "Multiple Choice", trueFalse: "True / False", shortAnswer: "Short Answer" };

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
      points: editTarget.points ?? 1,
    };
  }
  return { question: "", questionType: "mcq", options: ["", ""], correctAnswer: "", points: 1 };
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
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                  ))}
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

            {form.questionType === "shortAnswer" && (
              <div>
                <Label>Model Answer (optional)</Label>
                <input style={fieldStyle} placeholder="Reference answer for grading" value={form.correctAnswer} onChange={(e) => setField("correctAnswer", e.target.value)} />
              </div>
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
