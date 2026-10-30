import { useState } from "react";
import { useUpdateLearnerHubLink } from "../../hooks/useLearners";
import { usePathway, usePathways, useAgeCategories, useAssignLearnerPathway, useRemoveLearnerPathway } from "../../../curriculum/hooks/useCompetencies";
import { useCoursesQuery } from "../../../courses/hooks/useCourse";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

// The pathways this learner is on, and where they sit in each one's course sequence (Robotics
// 1 → 2 → 3 → 4, etc.). The automatic one is the pathway for their Developmental Stage — its
// diagnostic places them, and it follows the stage selector below. Staff can add more by hand
// ("Add pathway"): the learner starts at its first course, moves up the ladder like any other
// placement, and sees its courses in My Courses (CompetencyService.assignPathway). Only a
// hand-added pathway can be removed. Stage lives on the hub enrollment link (`hubId`), not the
// learner record — see maybeAutoIssueDiagnostic's comment in learner.service.js.
// `stageSource` — who set the stage (learner_hub_links.stageSource): "age" | "diagnostic" | "staff".
const STAGE_SOURCE = {
  age: "Worked out from their age — moves if the date of birth or age is corrected",
  diagnostic: "Set by their diagnostic — stays when the age changes",
  staff: "Chosen by hand — stays when the age changes (choose “Not set” to place by age again)",
};

export default function PathwayManagerCard({ learnerId, hubId, currentStageId, stageSource, curriculumId, canRemove }) {
  const { data: journey = [], isLoading: journeyLoading } = usePathway(curriculumId, learnerId);
  const { data: areas = [] } = usePathways(curriculumId);
  const { data: stages = [] } = useAgeCategories(curriculumId);
  const { data: coursesResponse } = useCoursesQuery();
  const { mutate: updateHubLink, isPending: savingStage } = useUpdateLearnerHubLink();
  const { mutate: assignPathway, isPending: assigning } = useAssignLearnerPathway(curriculumId, learnerId);
  const { mutate: removePathway, isPending: removing } = useRemoveLearnerPathway(curriculumId, learnerId);
  const [addId, setAddId] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);

  if (!curriculumId || journeyLoading) return null;

  const allCourses = coursesResponse?.data || [];
  const courseNameById = new Map(allCourses.map((c) => [c.id, c.name]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));
  const onIds = new Set(journey.map((j) => j.pathwayId));
  // A pathway is one row per stage, so each option names its stage too.
  const addable = areas
    .filter((a) => !onIds.has(a.id))
    .map((a) => ({ ...a, label: `${a.name} — ${stageNameById.get(a.ageCategoryId) || "No stage yet"}`, empty: (a.courses || []).length === 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pathways</h3>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9CA3AF" }}>
        The pathway for this learner's stage is assigned automatically. Add others by hand — they start at the first course, and its courses appear in the learner's My Courses.
      </p>

      {stages.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Developmental Stage:</span>
          <select
            value={currentStageId || ""}
            disabled={savingStage || !hubId}
            onChange={(e) => updateHubLink({ learnerId, hubId, data: { currentStageId: e.target.value || null } })}
            style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#111827" }}
          >
            <option value="">Not set</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {currentStageId && STAGE_SOURCE[stageSource] && <span style={{ fontSize: 12, color: "#9CA3AF" }}>{STAGE_SOURCE[stageSource]}</span>}
        </div>
      )}

      {journey.length === 0 ? (
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "#9CA3AF" }}>
          Not on any pathway yet — set a Developmental Stage for the automatic one, or add one below.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {journey.map((j) => {
            const area = areaById.get(j.pathwayId);
            const areaColor = area?.color || "#25476a";
            const courseName = j.currentCourseId ? courseNameById.get(j.currentCourseId) : null;
            const courseIds = j.courseIds || [];
            const step = j.currentCourseId ? courseIds.indexOf(j.currentCourseId) + 1 : 0;
            const manual = j.source === "manual";
            const stageName = stageNameById.get(j.stageId);
            return (
              <div key={j.pathwayId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "#FAFCFF", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 180, flex: 1, flexWrap: "wrap" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: areaColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{j.pathwayName}</span>
                  {stageName && <span style={{ fontSize: 11, color: "#6B7280" }}>{stageName}</span>}
                  <span style={{ padding: "1px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, backgroundColor: manual ? "#F5F3FF" : "#e8f5fb", color: manual ? "#6D28D9" : ACCENT, border: `1px solid ${manual ? "#DDD6FE" : "#a8d5ee"}` }}>
                    {manual ? "Added by staff" : "Automatic · stage"}
                  </span>
                </div>
                {courseName ? (
                  <>
                    <span style={{ fontSize: 13, color: "#111827" }}>
                      {courseName}{step > 0 && courseIds.length > 1 ? ` · step ${step} of ${courseIds.length}` : ""}
                    </span>
                    <span style={{ fontSize: 11, color: j.isDefault ? "#9CA3AF" : "#059669", fontWeight: 600 }}>
                      {j.isDefault ? "Awaiting diagnostic" : `Placed${j.history.length > 1 ? ` · ${j.history.length} changes` : ""}`}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>No course sequenced yet</span>
                )}
                {manual && canRemove && (
                  <button type="button" disabled={removing} onClick={() => setRemoveTarget(j)} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: removing ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif" }}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addable.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F3F4F6", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            style={{ flex: 1, minWidth: 220, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151" }}
          >
            <option value="">Add a pathway…</option>
            {addable.map((a) => (
              <option key={a.id} value={a.id} disabled={a.empty}>{a.label}{a.empty ? " (no courses yet)" : ""}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!addId || assigning}
            onClick={() => assignPathway(addId, { onSuccess: () => setAddId("") })}
            style={{ padding: "8px 16px", backgroundColor: !addId || assigning ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: !addId || assigning ? "not-allowed" : "pointer", flexShrink: 0 }}
          >
            {assigning ? "Adding…" : "Add pathway"}
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!removeTarget}
        title="Remove Pathway"
        message={`"${removeTarget?.pathwayName}" will be taken off this learner, with their progress through its courses. Its courses leave their My Courses unless their class has them too.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          removePathway(removeTarget.pathwayId);
          setRemoveTarget(null);
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
