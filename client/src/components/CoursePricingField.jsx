import { useCurriculumCourses } from "../modules/curriculum/hooks/useCurriculum";
import { usePathways } from "../modules/curriculum/hooks/useCompetencies";

// `value`/`onChange` carry [{ courseId, priceAmount, priceCurrency }] — same shape the server
// validates in bootcamp.validation.js / competition.validation.js's coursePriceSchema.
//
// Groups the selected curriculum's linked courses under the pathway(s) that list them (a course
// can appear under more than one pathway, same as pathway.courses can share a course), with any
// linked course that no pathway claims falling into an "Other courses" section — so nothing a
// curriculum actually offers is silently left unpriceable.
export default function CoursePricingField({ curriculumId, value = [], onChange, color = "#25476a" }) {
  const { data: courses, isLoading: loadingCourses } = useCurriculumCourses(curriculumId);
  const { data: pathways, isLoading: loadingPathways } = usePathways(curriculumId);

  if (!curriculumId) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>
        Select a curriculum above to price its courses.
      </p>
    );
  }

  if (loadingCourses || loadingPathways) {
    return <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>Loading courses…</p>;
  }

  const allCourses = courses || [];
  const courseById = Object.fromEntries(allCourses.map((c) => [c.id, c]));
  const priceById = Object.fromEntries(value.map((v) => [v.courseId, v]));

  const setPrice = (courseId, patch) => {
    const existing = priceById[courseId] || { courseId, priceAmount: null, priceCurrency: "KES" };
    const next = { ...existing, ...patch };
    const withoutCourse = value.filter((v) => v.courseId !== courseId);
    onChange([...withoutCourse, next]);
  };

  const removePrice = (courseId) => onChange(value.filter((v) => v.courseId !== courseId));

  const groups = (pathways || [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      courseIds: (p.courses || []).filter((id) => courseById[id]),
    }))
    .filter((g) => g.courseIds.length > 0);

  const groupedCourseIds = new Set(groups.flatMap((g) => g.courseIds));
  const ungrouped = allCourses.filter((c) => !groupedCourseIds.has(c.id));

  if (allCourses.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>
        This curriculum has no courses linked yet — add courses to it before pricing them here.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((g) => (
        <CourseGroup
          key={g.id}
          title={g.name}
          accent={g.color || color}
          courseIds={g.courseIds}
          courseById={courseById}
          priceById={priceById}
          setPrice={setPrice}
          removePrice={removePrice}
        />
      ))}
      {ungrouped.length > 0 && (
        <CourseGroup
          title={groups.length > 0 ? "Other courses" : null}
          accent={color}
          courseIds={ungrouped.map((c) => c.id)}
          courseById={courseById}
          priceById={priceById}
          setPrice={setPrice}
          removePrice={removePrice}
        />
      )}
    </div>
  );
}

function CourseGroup({ title, accent, courseIds, courseById, priceById, setPrice, removePrice }) {
  return (
    <div>
      {title && (
        <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {title}
        </h4>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {courseIds.map((courseId) => {
          const course = courseById[courseId];
          const price = priceById[courseId];
          const checked = !!price;
          return (
            <div
              key={courseId}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                border: "1.5px solid #E5E7EB", borderRadius: 8, backgroundColor: checked ? "#F9FAFB" : "#fff",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) setPrice(courseId, {});
                  else removePrice(courseId);
                }}
                style={{ width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {course.name}
              </span>
              {checked && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <input
                    value={price.priceCurrency ?? "KES"}
                    onChange={(e) => setPrice(courseId, { priceCurrency: e.target.value })}
                    style={{ width: 56, padding: "6px 8px", borderRadius: 6, border: "1.5px solid #E5E7EB", fontSize: 12.5, fontFamily: "Inter, sans-serif" }}
                    aria-label={`Currency for ${course.name}`}
                  />
                  <input
                    type="number"
                    min="0"
                    value={price.priceAmount ?? ""}
                    onChange={(e) => setPrice(courseId, { priceAmount: e.target.value === "" ? null : Number(e.target.value) })}
                    style={{ width: 100, padding: "6px 8px", borderRadius: 6, border: "1.5px solid #E5E7EB", fontSize: 12.5, fontFamily: "Inter, sans-serif" }}
                    placeholder="Price"
                    aria-label={`Price for ${course.name}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
