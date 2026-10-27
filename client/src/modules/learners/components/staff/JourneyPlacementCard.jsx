import { useUpdateLearner } from "../../hooks/useLearners";
import { useLadder } from "../../../curriculum/hooks/useCompetencies";

// Mirrors ProfileIdentityCard.jsx/LearnerFormPreview.jsx's own computeAge — display-only, kept
// as a local duplicate rather than a shared import, same as those two.
function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Parses a rung's free-text ageRange ("12-14", "15+", "5") into numeric bounds. Mirrors
// learner.service.js's own parseAgeRange exactly — same reasoning: rungs never got structured
// minAge/maxAge columns, just a display string, so this is the only way to match one against a
// learner's computed age.
function parseAgeRange(ageRange) {
  const nums = (ageRange || "").match(/\d+(\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const min = Number(nums[0]);
  const max = nums.length > 1 ? Number(nums[1]) : ((ageRange || "").includes("+") ? null : min);
  return { min, max };
}

// Where this learner currently sits on their curriculum's Pathway (Progression
// Ladder) — set manually here, e.g. by age at enrollment or after a diagnostic assessment. The
// server already auto-places a rung by age on enroll/class-change (maybeAutoPlaceRung,
// learner.service.js), but only when currentRungId is still empty at that moment — a learner
// already on record before a curriculum had rungs, or moved between curricula, can be left
// unplaced with no further automatic retry. This surfaces the same age-match as a one-click
// suggestion here instead, rather than silently auto-setting it behind the admin's back.
// Only renders once the learner's class resolves to a curriculum with stages defined.
export default function JourneyPlacementCard({ learnerId, currentRungId, curriculumId, dateOfBirth }) {
  const { data: rungs = [], isLoading } = useLadder(curriculumId);
  const { mutate: updateLearner, isPending: saving } = useUpdateLearner();

  if (!curriculumId || isLoading) return null;
  if (rungs.length === 0) return null;

  const sorted = [...rungs].sort((a, b) => a.order - b.order);
  const current = sorted.find((r) => r.id === currentRungId) || null;

  const age = computeAge(dateOfBirth);
  const suggested = !current && age !== null
    ? sorted.find((r) => {
        const range = parseAgeRange(r.ageRange);
        return range && age >= range.min && (range.max == null || age <= range.max);
      })
    : null;

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pathway Placement</h3>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9CA3AF" }}>
        Which stage of this curriculum's Pathway this learner is starting from.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <select
          value={currentRungId || ""}
          disabled={saving}
          onChange={(e) => updateLearner({ id: learnerId, data: { currentRungId: e.target.value || null } })}
          style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", color: "#111827", minWidth: 220 }}
        >
          <option value="">Not yet placed</option>
          {sorted.map((r) => (
            <option key={r.id} value={r.id}>{r.label}{r.ageRange ? ` (${r.ageRange} yrs)` : ""}</option>
          ))}
        </select>
        {current
          ? <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>Placed at "{current.label}"</span>
          : suggested
          ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9CA3AF" }}>
              No starting stage set yet — age-appropriate: <strong style={{ color: "#111827" }}>{suggested.label}</strong>
              <button
                type="button"
                disabled={saving}
                onClick={() => updateLearner({ id: learnerId, data: { currentRungId: suggested.id } })}
                style={{ padding: "4px 10px", borderRadius: 20, border: "1.5px solid #a8d5ee", background: "#e8f5fb", color: "#25476a", fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: saving ? "not-allowed" : "pointer" }}
              >
                Auto-place
              </button>
            </span>
          )
          : <span style={{ fontSize: 12, color: "#9CA3AF" }}>No starting stage set yet</span>}
      </div>
    </div>
  );
}
