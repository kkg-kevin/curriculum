import { useState } from "react";
import { rubricCriterionSchema } from "../schemas/assessment.schema";
import { useAddRubricCriterion, useUpdateRubricCriterion } from "../hooks/useAssessment";
import { Editor as RichTextField } from "../../courses/components/RichTextEditor";

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

function Label({ children }) {
  return <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "5px" }}>{children}</label>;
}

export default function RubricCriterionModal({ assessmentId, editTarget, onClose }) {
  const { mutate: addCriterion, isPending: adding } = useAddRubricCriterion();
  const { mutate: updateCriterion, isPending: updating } = useUpdateRubricCriterion();
  const isPending = adding || updating;

  const [form, setForm] = useState(() => ({
    criterion: editTarget?.criterion || "",
    description: editTarget?.description || "",
    points: editTarget?.points ?? 10,
  }));
  const [error, setError] = useState("");

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const result = rubricCriterionSchema.safeParse({ ...form, points: Number(form.points) });
    if (!result.success) {
      setError(result.error.issues[0]?.message || "Please check the criterion details");
      return;
    }

    if (editTarget) {
      updateCriterion({ assessmentId, criterionId: editTarget.id, data: result.data }, { onSuccess: onClose });
    } else {
      addCriterion({ assessmentId, data: result.data }, { onSuccess: onClose });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
      <div style={{ background: "#F3F4F6", borderRadius: "16px", width: "100%", maxWidth: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: "16px 16px 0 0", borderBottom: "1px solid #E5E7EB" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0F2645" }}>
            {editTarget ? "Edit Criterion" : "Add Rubric Criterion"}
          </h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {error && (
              <div style={{ padding: "10px 14px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "10px", color: "#EF4444", fontSize: "13px" }}>
                {error}
              </div>
            )}

            <div>
              <Label>Criterion *</Label>
              <input style={fieldStyle} placeholder="e.g. Clarity of argument" value={form.criterion} onChange={(e) => setField("criterion", e.target.value)} />
            </div>

            <div>
              <Label>Description</Label>
              <RichTextField value={form.description} onChange={(html) => setField("description", html)} />
            </div>

            <div style={{ width: "140px" }}>
              <Label>Points</Label>
              <input type="number" min="0" style={fieldStyle} value={form.points} onChange={(e) => setField("points", e.target.value)} />
            </div>
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
              {isPending ? "Saving…" : editTarget ? "Save Changes" : "Add Criterion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
