import { useCurriculumCourses } from "../modules/curriculum/hooks/useCurriculum";
import { usePathways } from "../modules/curriculum/hooks/useCompetencies";

function formatCoursePrice(p) {
  if (p.priceAmount == null) return "Enquire for pricing";
  return `${p.priceCurrency || "KES"} ${Number(p.priceAmount).toLocaleString()}`;
}

// Read-only counterpart to CoursePricingField — renders the curriculum's pathways (and any
// linked-but-unpathwayed courses) with the price set for each, or nothing at all once a
// bootcamp/competition has no priced courses.
export default function CoursePricingDisplay({ curriculumId, coursePricing = [] }) {
  const { data: courses, isLoading: loadingCourses } = useCurriculumCourses(curriculumId);
  const { data: pathways, isLoading: loadingPathways } = usePathways(curriculumId);

  if (coursePricing.length === 0) return null;
  if (loadingCourses || loadingPathways) {
    return <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Loading course pricing…</p>;
  }

  const allCourses = courses || [];
  const courseById = Object.fromEntries(allCourses.map((c) => [c.id, c]));
  const priceById = Object.fromEntries(coursePricing.map((p) => [p.courseId, p]));
  const pricedCourseIds = new Set(coursePricing.map((p) => p.courseId));

  const groups = (pathways || [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      courseIds: (p.courses || []).filter((id) => pricedCourseIds.has(id)),
    }))
    .filter((g) => g.courseIds.length > 0);

  const groupedCourseIds = new Set(groups.flatMap((g) => g.courseIds));
  const ungroupedIds = coursePricing.map((p) => p.courseId).filter((id) => !groupedCourseIds.has(id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((g) => (
        <PricedGroup key={g.id} title={g.name} accent={g.color || "#25476a"} courseIds={g.courseIds} courseById={courseById} priceById={priceById} />
      ))}
      {ungroupedIds.length > 0 && (
        <PricedGroup title={groups.length > 0 ? "Other courses" : null} accent="#25476a" courseIds={ungroupedIds} courseById={courseById} priceById={priceById} />
      )}
    </div>
  );
}

function PricedGroup({ title, accent, courseIds, courseById, priceById }) {
  return (
    <div>
      {title && (
        <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {title}
        </h4>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {courseIds.map((courseId) => {
          const course = courseById[courseId];
          const price = priceById[courseId];
          return (
            <div key={courseId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{course?.name || "Unknown course"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#25476a", whiteSpace: "nowrap" }}>{formatCoursePrice(price)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
