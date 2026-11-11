import { T, cardStyle, KID, KidHeading } from "./theme";
import { usePathway, usePathways } from "../../../curriculum/hooks/useCompetencies";
import { useCoursesQuery } from "../../../courses/hooks/useCourse";
import { useState } from "react";
import { FiChevronDown, FiCompass } from "react-icons/fi";
import PathwayStagesList from "../../../learners/components/PathwayStagesList";

// Read-only counterpart to the staff learner page's PathwayManagerCard — the same pathways (their
// stage's one, plus any staff added by hand) and placement status, just without the stage
// selector or add/remove controls, since a learner should never be able to re-place themselves.
// Each pathway opens to its courses, stage by stage, with where the learner is (PathwayStagesList).
function JourneyRow({ row, courseNameById }) {
  const [open, setOpen] = useState(false);
  const areaColor = row.color || T.accent;
  const courseName = row.currentCourseId ? courseNameById.get(row.currentCourseId) || row.stages?.flatMap((st) => st.courses).find((c) => c.id === row.currentCourseId)?.name : null;
  // The pathway's courses, every stage (the server sends them with the pathway); an older server
  // without them falls back to this stage's courses.
  const stages = row.stages || [{ pathwayId: row.pathwayId, isLearnerStage: true, courses: (row.courseIds || []).map((id) => ({ id, name: courseNameById.get(id) || "Course" })) }];
  const total = stages.reduce((n, st) => n + st.courses.length, 0);
  const toggle = () => setOpen((v) => !v);

  return (
    <div style={{ padding: "12px 14px", borderRadius: 10, backgroundColor: "#FAFCFF", border: `1px solid ${open ? "#E5EEF6" : "transparent"}` }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        title={open ? "Hide this pathway's courses" : "Show this pathway's courses"}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160, flex: 1, flexWrap: "wrap" }}>
          <FiChevronDown size={14} color={T.inkFaint} style={{ flexShrink: 0, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s ease" }} />
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
          <span style={{ fontSize: 11.5, color: T.inkFaint }}>{total ? `${total} course${total === 1 ? "" : "s"} · not started yet` : "No course sequenced yet"}</span>
        )}
      </div>
      {open && <PathwayStagesList stages={stages} currentCourseId={row.currentCourseId} color={areaColor} awaitingDiagnostic={row.isDefault} audience="learner" />}
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
