import { useState } from "react";
import { FiActivity } from "react-icons/fi";
import { usePathways, useAgeCategories, usePerformanceBands } from "../../../curriculum/hooks/useCompetencies";
import { useDiagnosticForLearner, usePathwayDiagnosticsForLearner, useGradeSubmission, useReissueAssessment } from "../../../assessments/hooks/useAssessmentSubmission";
import DiagnosticGradingModal from "../../../assessments/components/DiagnosticGradingModal";

// Diagnostics are a distinct category from every other card on this page (Guardian, Learning
// Hubs, Pathway, etc. all share the standard teal heading) — this violet accent plus
// the FiActivity icon is what sets them apart at a glance.
const DIAGNOSTIC_ACCENT = "#7C3AED";

const DIAGNOSTIC_STATUS_STYLES = {
  not_started: { label: "Not Started",   bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  in_progress: { label: "In Progress",   bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  submitted:   { label: "Needs Grading", bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  graded:      { label: "Graded",        bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};

function DiagnosticStatusBadge({ status }) {
  const s = DIAGNOSTIC_STATUS_STYLES[status] || DIAGNOSTIC_STATUS_STYLES.not_started;
  return (
    <span style={{ display: "inline-flex", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// Gives this learner another attempt at a diagnostic they didn't perform well on — creates a
// new issue rather than resetting the graded one (see reissueToLearner's comment server-side),
// so ageCategoryId/pathwayId are carried over onto the new issue specifically so grading
// the retake still re-triggers the learner's Stage/Pathway placement. Once clicked, this
// row's own "Grade Now" flow disappears — the fresh attempt shows up as a new row/card instead
// (both cards key their query off getDiagnosticForLearner/getPathwayDiagnosticsForLearner,
// which surface the most-recently-issued row first).
function ReissueButton({ issueId, learnerId }) {
  const { mutate: reissue, isPending } = useReissueAssessment();
  return (
    <button
      type="button"
      onClick={() => reissue({ issueId, learnerId })}
      disabled={isPending}
      style={{ padding: "8px 16px", backgroundColor: isPending ? "#F9FAFB" : "#fff", color: DIAGNOSTIC_ACCENT, border: `1.5px solid ${DIAGNOSTIC_ACCENT}55`, borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
    >
      {isPending ? "Reissuing…" : "Reissue"}
    </button>
  );
}

// The auto-issued diagnostic (see age-category.model.js's diagnosticAssessmentId +
// learner.service.js's maybeAutoIssueDiagnostic) that placed — or will place — this learner.
// Grading it here (rather than through the usual class roster) is what triggers
// CompetencyService.placeLearnerFromDiagnostic server-side, since this issue has no class.
export function DiagnosticAssessmentCard({ learnerId, currentStageId, currentBandId, curriculumId }) {
  const { data: row, isLoading } = useDiagnosticForLearner(learnerId);
  const { data: stages = [] } = useAgeCategories(curriculumId);
  const { data: bands = [] } = usePerformanceBands(curriculumId);
  const { mutate: grade, isPending: grading } = useGradeSubmission();
  const [gradeOpen, setGradeOpen] = useState(false);

  if (isLoading) return null;

  const stageName = stages.find((s) => s.id === currentStageId)?.name;
  const bandName = bands.find((b) => b.id === currentBandId)?.name;

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, borderLeft: `4px solid ${DIAGNOSTIC_ACCENT}`, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: DIAGNOSTIC_ACCENT, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}><FiActivity size={14} /> Diagnostic Assessment</h3>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9CA3AF" }}>
        Auto-issued based on this learner's age; grading it sets their Developmental Stage and Performance Band below.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Developmental Stage</span>
          <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 600, color: "#111827" }}>{stageName || "Not set"}</p>
        </div>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Performance Band</span>
          <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 600, color: "#111827" }}>{bandName || "Not yet placed"}</p>
        </div>
      </div>

      {!row ? (
        <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
          No diagnostic issued yet — this happens automatically once the learner's age matches a Developmental Stage that has one configured (Curriculum → Competencies → Progress Arc).
        </p>
      ) : (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#FAFCFF", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>{row.assessment.name}</p>
            <DiagnosticStatusBadge status={row.submission.status} />
            {row.submission.status === "graded" && (
              <span style={{ fontSize: 12, fontWeight: 700, color: DIAGNOSTIC_ACCENT }}>{row.submission.totalScore}/{row.submission.maxScore}</span>
            )}
          </div>
          {row.submission.status === "submitted" && (
            <button type="button" onClick={() => setGradeOpen(true)} style={{ padding: "8px 16px", backgroundColor: DIAGNOSTIC_ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Grade Now
            </button>
          )}
          {row.submission.status === "graded" && (
            <ReissueButton key={row.issue.id} issueId={row.issue.id} learnerId={learnerId} />
          )}
        </div>
      )}

      {gradeOpen && row && (
        <DiagnosticGradingModal
          title={`Grade Diagnostic — ${row.assessment.name}`}
          assessment={row.assessment}
          submission={row.submission}
          isSaving={grading}
          onSave={(payload) => grade({ id: row.submission.id, ...payload }, { onSuccess: () => setGradeOpen(false) })}
          onClose={() => setGradeOpen(false)}
        />
      )}
    </div>
  );
}

// One diagnostic per Pathway the learner's class exposes (see learner.service.js's
// maybeAutoIssuePathwayDiagnostics) — a separate placement identity from the single
// Developmental Stage diagnostic above: grading one of these sets the learner's starting course
// in that specific area (via CompetencyService.placeLearnerFromPathwayDiagnostic), reflected
// below in the Pathway card once graded. Only one grading modal open at a time, keyed by
// issue id so grading one row doesn't also open every other row's panel.
export function PathwayDiagnosticsCard({ learnerId, curriculumId }) {
  const { data: rows = [], isLoading } = usePathwayDiagnosticsForLearner(learnerId);
  const { data: areas = [] } = usePathways(curriculumId);
  const { mutate: grade, isPending: grading } = useGradeSubmission();
  const [gradeOpenId, setGradeOpenId] = useState(null);

  if (isLoading || rows.length === 0) return null;

  const areaNameById = new Map(areas.map((a) => [a.id, a.name]));
  const openRow = rows.find((r) => r.issue.id === gradeOpenId) || null;

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, borderLeft: `4px solid ${DIAGNOSTIC_ACCENT}`, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: DIAGNOSTIC_ACCENT, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}><FiActivity size={14} /> Pathway Diagnostics</h3>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9CA3AF" }}>
        One diagnostic per pathway this learner's class exposes; grading one places them at a starting course in that area, below.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => (
          <div key={row.issue.id} style={{ padding: "12px 14px", borderRadius: 10, background: "#FAFCFF", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: DIAGNOSTIC_ACCENT }}>{areaNameById.get(row.issue.pathwayId) || "Unknown area"}</span>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>{row.assessment.name}</p>
              <DiagnosticStatusBadge status={row.submission.status} />
              {row.submission.status === "graded" && (
                <span style={{ fontSize: 12, fontWeight: 700, color: DIAGNOSTIC_ACCENT }}>{row.submission.totalScore}/{row.submission.maxScore}</span>
              )}
            </div>
            {row.submission.status === "submitted" && (
              <button type="button" onClick={() => setGradeOpenId(row.issue.id)} style={{ padding: "8px 16px", backgroundColor: DIAGNOSTIC_ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                Grade Now
              </button>
            )}
            {row.submission.status === "graded" && (
              <ReissueButton key={row.issue.id} issueId={row.issue.id} learnerId={learnerId} />
            )}
          </div>
        ))}
      </div>

      {openRow && (
        <DiagnosticGradingModal
          title={`Grade Diagnostic — ${openRow.assessment.name}`}
          assessment={openRow.assessment}
          submission={openRow.submission}
          isSaving={grading}
          onSave={(payload) => grade({ id: openRow.submission.id, ...payload }, { onSuccess: () => setGradeOpenId(null) })}
          onClose={() => setGradeOpenId(null)}
        />
      )}
    </div>
  );
}
