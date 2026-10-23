import { T, cardStyle, sectionHeaderStyle } from "./theme";
import { usePathway, usePathways } from "../../../curriculum/hooks/useCompetencies";
import { useCoursesQuery } from "../../../courses/hooks/useCourse";

// Read-only counterpart to LearnerViewPage.jsx's PathwayCard (admin) — same per-Learning-
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
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{row.pathwayName}</span>
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

export default function PathwayTabContent({ learnerId, curriculumId }) {
  const { data: journey = [], isLoading: journeyLoading } = usePathway(curriculumId, learnerId);
  const { data: areas = [] } = usePathways(curriculumId);
  const { data: coursesResponse } = useCoursesQuery();

  const areaColorById = new Map(areas.map((a) => [a.id, a.color]));
  const courseNameById = new Map((coursesResponse?.data || []).map((c) => [c.id, c.name]));
  // Only the pathway(s) the learner is actually in — placed by their diagnostic or by staff. The
  // rest are just "default" rows for every pathway the curriculum offers (the staff view needs
  // those to place a learner; the learner doesn't).
  const rows = journey.filter((j) => !j.isDefault).map((j) => ({ ...j, color: areaColorById.get(j.pathwayId) }));

  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <h2 style={{ ...sectionHeaderStyle(), marginBottom: 4 }}>Pathway</h2>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: T.inkMuted }}>
        The pathway you're enrolled in, and where you sit in its course sequence.
      </p>

      {journeyLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
      ) : !curriculumId || rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>
          You haven't been placed in a pathway yet — this happens after your diagnostic assessment.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((row) => (
            <JourneyRow key={row.pathwayId} row={row} courseNameById={courseNameById} />
          ))}
        </div>
      )}
    </div>
  );
}
