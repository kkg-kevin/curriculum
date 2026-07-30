import GradingPanel from "./GradingPanel";

// Shared "grade this diagnostic" overlay — the same GradingPanel wrapped in an identical modal
// shell used to appear separately in LearnerViewPage.jsx's two diagnostic cards and the teacher
// portal's Needs Grading queue. Diagnostics are single-learner issues (no class roster to open
// instead), so grading always happens inline like this rather than via a roster page.
export default function DiagnosticGradingModal({ title, assessment, submission, isSaving, onSave, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,38,69,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto", padding: "22px 26px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 16 }}>✕</button>
        </div>
        <GradingPanel assessment={assessment} submission={submission} isSaving={isSaving} onSave={onSave} />
      </div>
    </div>
  );
}
