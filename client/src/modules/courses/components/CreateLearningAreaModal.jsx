import { useState } from "react";
import { useCreateLearningArea } from "../../settings/learning-areas/hooks/useLearningAreas";
import CoursePickerField from "./CoursePickerField";

const AREA_COLORS = [
  "#25476a", "#38aae1", "#059669", "#7C3AED",
  "#DC2626", "#D97706", "#0891B2", "#BE185D",
  "#2e7db5", "#0A3880",
];

// Shared by LearningAreasField (Courses/Assessments) — creating here always writes
// to the global Settings catalog. Curriculum has its own richer local-copy create
// form (see LearningAreasPanel in CompetenciesPage.jsx) that syncs to this same
// catalog separately, so it doesn't use this modal.
export default function CreateLearningAreaModal({ initialName = "", onClose, onCreated }) {
  const { mutate: createLearningArea, isPending } = useCreateLearningArea();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(AREA_COLORS[0]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");

  const submit = () => {
    if (!name.trim()) { setError("Name is required"); return; }
    createLearningArea({ name: name.trim(), description: description.trim(), color, courses }, {
      onSuccess: (newArea) => { onCreated(newArea.id); onClose(); },
    });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#fff" }}>New Learning Area</h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Added to the shared catalog in Settings</p>
        </div>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ padding: "9px 12px", background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "9px", color: "#EF4444", fontSize: "12.5px" }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Language & Literacy"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", resize: "vertical" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>Color</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {AREA_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  style={{
                    width: "26px", height: "26px", borderRadius: "50%", cursor: "pointer", padding: 0,
                    backgroundColor: c, border: color === c ? "2px solid #111827" : "2px solid #fff",
                    boxShadow: "0 0 0 1.5px #E5E7EB",
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px" }}>
              Courses <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span>
            </label>
            <CoursePickerField value={courses} onChange={setCourses} color={color} />
          </div>
        </div>
        <div style={{ padding: "14px 22px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 16px", background: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            style={{ padding: "9px 18px", background: isPending ? "#fde3b0" : "#feb139", color: "#25476a", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Creating…" : "Create Learning Area"}
          </button>
        </div>
      </div>
    </div>
  );
}
