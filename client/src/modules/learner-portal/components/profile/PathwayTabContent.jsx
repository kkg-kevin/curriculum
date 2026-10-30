import { T, cardStyle, KID, KidHeading } from "./theme";
import { usePathway, usePathways } from "../../../curriculum/hooks/useCompetencies";
import { useCoursesQuery } from "../../../courses/hooks/useCourse";
import { FiCompass } from "react-icons/fi";

// Read-only counterpart to the staff learner page's PathwayManagerCard — the same pathways (their
// stage's one, plus any staff added by hand) and placement status, just without the stage
// selector or add/remove controls, since a learner should never be able to re-place themselves.
function JourneyRow({ row, courseNameById }) {
  const areaColor = row.color || T.accent;
  const courseName = row.currentCourseId ? courseNameById.get(row.currentCourseId) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, backgroundColor: "#FAFCFF", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160, flex: 1, flexWrap: "wrap" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: areaColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{row.pathwayName}</span>
        {row.source === "manual" && (
          <span style={{ padding: "1px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, backgroundColor: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE" }}>Added by your hub</span>
        )}
      </div>
      {courseName ? (
        <>
          <span style={{ fontSize: 13, color: T.ink }}>{courseName}</span>
          <span style={{ fontSize: 11, color: row.isDefault ? T.inkFaint : "#059669", fontWeight: 600 }}>
            {row.isDefault ? "Starting point — your diagnostic confirms it" : `Placed${row.history?.length > 1 ? ` · ${row.history.length} changes` : ""}`}
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
  // Only the pathways this learner is on (CompetencyService.getPathway): their stage's one —
  // before its diagnostic is graded, at its first course — and any staff added by hand.
  const rows = journey.map((j) => ({ ...j, color: areaColorById.get(j.pathwayId) }));

  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <KidHeading icon={FiCompass} tone={KID.sky} sub="The pathways you're on, and which course you're up to in each.">Pathways</KidHeading>

      {journeyLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
      ) : !curriculumId || rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>
          You're not on a pathway yet — your hub will set one up for you.
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
