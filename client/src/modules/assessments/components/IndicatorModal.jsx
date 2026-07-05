import { useState } from "react";
import { indicatorSchema, DEFAULT_RATING_SCALE } from "../schemas/assessment.schema";
import { useAddIndicator, useUpdateIndicator } from "../hooks/useAssessment";

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

export default function IndicatorModal({ assessmentId, editTarget, onClose }) {
  const { mutate: addIndicator, isPending: adding } = useAddIndicator();
  const { mutate: updateIndicator, isPending: updating } = useUpdateIndicator();
  const isPending = adding || updating;

  const [text, setText] = useState(editTarget?.text || "");
  const [ratingScale, setRatingScale] = useState(editTarget?.ratingScale?.length ? editTarget.ratingScale : DEFAULT_RATING_SCALE);
  const [ratingInput, setRatingInput] = useState("");
  const [error, setError] = useState("");

  const addRating = () => {
    const value = ratingInput.trim();
    if (!value || ratingScale.includes(value)) { setRatingInput(""); return; }
    setRatingScale((prev) => [...prev, value]);
    setRatingInput("");
  };
  const removeRating = (value) => {
    setRatingScale((prev) => prev.filter((r) => r !== value));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const result = indicatorSchema.safeParse({ text, ratingScale });
    if (!result.success) {
      setError(result.error.issues[0]?.message || "Please check the indicator details");
      return;
    }

    if (editTarget) {
      updateIndicator({ assessmentId, indicatorId: editTarget.id, data: result.data }, { onSuccess: onClose });
    } else {
      addIndicator({ assessmentId, data: result.data }, { onSuccess: onClose });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
      <div style={{ background: "#F3F4F6", borderRadius: "16px", width: "100%", maxWidth: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: "16px 16px 0 0", borderBottom: "1px solid #E5E7EB" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0F2645" }}>
            {editTarget ? "Edit Indicator" : "Add Indicator"}
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
              <Label>Indicator *</Label>
              <input
                style={fieldStyle}
                placeholder="e.g. Follows multi-step instructions"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <div>
              <Label>Rating Scale</Label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  style={fieldStyle}
                  placeholder="Add a rating level"
                  value={ratingInput}
                  onChange={(e) => setRatingInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRating(); } }}
                />
                <button
                  type="button"
                  onClick={addRating}
                  disabled={!ratingInput.trim()}
                  style={{ padding: "0 18px", borderRadius: "10px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: ratingInput.trim() ? "pointer" : "not-allowed", opacity: ratingInput.trim() ? 1 : 0.5, flexShrink: 0 }}
                >
                  + Add
                </button>
              </div>
              {ratingScale.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginTop: "8px" }}>
                  {ratingScale.map((r) => (
                    <span
                      key={r}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 8px 4px 12px", borderRadius: "20px", border: "1.5px solid #a8d5ee", backgroundColor: "#e8f5fb", color: "#25476a", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif" }}
                    >
                      {r}
                      <button
                        type="button"
                        onClick={() => removeRating(r)}
                        title={`Remove ${r}`}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: 0, color: "inherit" }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
              {isPending ? "Saving…" : editTarget ? "Save Changes" : "Add Indicator"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
