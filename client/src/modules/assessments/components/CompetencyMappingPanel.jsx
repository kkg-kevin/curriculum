import { useCompetencies } from "../../settings/hooks/useCompetencies";
import { PROGRESS_ARC_LEVELS, PROGRESS_ARC_LEVEL_LABELS } from "../schemas/templateBuilder.schema";

const fieldStyle = {
  padding: "8px 10px", borderRadius: "9px", border: "1.5px solid #E5E7EB", fontSize: "12.5px",
  fontFamily: "Inter, sans-serif", backgroundColor: "#fff", color: "#374151", outline: "none",
  width: "100%", boxSizing: "border-box",
};

function Label({ children }) {
  return <label style={{ fontSize: "11px", fontWeight: "700", color: "#6B7280", display: "block", marginBottom: "4px" }}>{children}</label>;
}

// Shared item-level mapping subform: Competency (real dropdown, global catalog) + Progress Arc
// Level (fixed 5-tier label) + Learning Outcome / Performance Indicator (free text — see
// templateBuilder.schema.js for why those two aren't hard references).
export default function CompetencyMappingPanel({ mapping, onChange }) {
  const { data: competencies = [] } = useCompetencies();
  const value = mapping || {};
  const setField = (key, val) => onChange({ ...value, [key]: val });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div>
        <Label>Competency</Label>
        <select style={{ ...fieldStyle, cursor: "pointer" }} value={value.competencyId || ""} onChange={(e) => setField("competencyId", e.target.value)}>
          <option value="">— None —</option>
          {competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <Label>Progress Arc Level</Label>
        <select style={{ ...fieldStyle, cursor: "pointer" }} value={value.progressArcLevel || ""} onChange={(e) => setField("progressArcLevel", e.target.value || null)}>
          <option value="">— None —</option>
          {PROGRESS_ARC_LEVELS.map((l) => <option key={l} value={l}>{PROGRESS_ARC_LEVEL_LABELS[l]}</option>)}
        </select>
      </div>
      <div>
        <Label>Learning Outcome</Label>
        <input style={fieldStyle} placeholder="e.g. Learner can explain how sensors work" value={value.learningOutcome || ""} onChange={(e) => setField("learningOutcome", e.target.value)} />
      </div>
      <div>
        <Label>Performance Indicator</Label>
        <input style={fieldStyle} placeholder="e.g. Uses correct terminology" value={value.performanceIndicator || ""} onChange={(e) => setField("performanceIndicator", e.target.value)} />
      </div>
    </div>
  );
}
