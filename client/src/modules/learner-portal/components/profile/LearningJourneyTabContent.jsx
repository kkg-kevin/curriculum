import { T, cardStyle, sectionHeaderStyle } from "./theme";
import { useLearningJourney, useLearningAreas } from "../../../curriculum/hooks/useCompetencies";
import { useCoursesQuery } from "../../../courses/hooks/useCourse";

// Read-only counterpart to LearnerViewPage.jsx's LearningJourneyCard (admin) — same per-Learning-
// Area course placement, same "Default placement" vs "Placed · N changes" status logic, just
// without the Developmental Stage / course <select> controls, since a learner should never be
// able to re-place themselves.
function JourneyRow({ row, courseNameById }) {
  const areaColor = row.color || T.accent;
  const courseName = row.currentCourseId ? courseNameById.get(row.currentCourseId) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, backgroundColor: "#FAFCFF", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160, flex: 1 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: areaColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{row.learningAreaName}</span>
      </div>
      {courseName ? (
        <>
          <span style={{ fontSize: 13, color: T.ink }}>{courseName}</span>
          <span style={{ fontSize: 11, color: row.isDefault ? T.inkFaint : "#059669", fontWeight: 600 }}>
            {row.isDefault ? "Default placement" : `Placed${row.history?.length > 1 ? ` · ${row.history.length} changes` : ""}`}
          </span>
        </>
      ) : (
        <span style={{ fontSize: 11.5, color: T.inkFaint }}>No course sequenced yet</span>
      )}
    </div>
  );
}

export default function LearningJourneyTabContent({ learnerId, curriculumId }) {
  const { data: journey = [], isLoading: journeyLoading } = useLearningJourney(curriculumId, learnerId);
  const { data: areas = [] } = useLearningAreas(curriculumId);
  const { data: coursesResponse } = useCoursesQuery();

  const areaColorById = new Map(areas.map((a) => [a.id, a.color]));
  const courseNameById = new Map((coursesResponse?.data || []).map((c) => [c.id, c.name]));
  const rows = journey.map((j) => ({ ...j, color: areaColorById.get(j.learningAreaId) }));

  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <h2 style={{ ...sectionHeaderStyle(), marginBottom: 4 }}>Learning Journey</h2>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: T.inkMuted }}>
        Where you currently sit in each learning area's course sequence.
      </p>

      {journeyLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
      ) : !curriculumId || rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>
          Your learning areas haven't been sequenced yet — check back once your curriculum sets this up.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((row) => (
            <JourneyRow key={row.learningAreaId} row={row} courseNameById={courseNameById} />
          ))}
        </div>
      )}
    </div>
  );
}
