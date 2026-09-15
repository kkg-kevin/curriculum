import { useState } from "react";
import { useCurriculumCourses } from "../modules/curriculum/hooks/useCurriculum";
import { usePathways } from "../modules/curriculum/hooks/useCompetencies";
import { useModules } from "../modules/courses/hooks/useCourse";

// `value`/`onChange` carry [{ courseId, priceAmount, priceCurrency, modulePricing }] — same shape
// the server validates in bootcamp.validation.js / competition.validation.js's coursePriceSchema.
// `modulePricing` ([{ moduleId, priceAmount, priceCurrency }]) is the per-course "price by module
// instead" addition: a course with more than one module can be broken into individually-priced
// modules rather than one course-wide price. It's mutually exclusive with that same course's own
// `priceAmount` (enforced in bootcamp.schema.js/bootcamp.service.js), same either/or posture as
// the whole-bootcamp-vs-by-course choice one level up.
//
// Groups the selected curriculum's linked courses under the pathway(s) that list them (a course
// can appear under more than one pathway, same as pathway.courses can share a course), with any
// linked course that no pathway claims falling into an "Other courses" section — so nothing a
// curriculum actually offers is silently left unpriceable.
//
// `disabled` (default false, backward-compatible for existing callers) greys out every checkbox/
// input without touching `value` — used by CreateBootcampPage.jsx when a whole-bootcamp price is
// already set, since a bootcamp is priced one way or the other, never both.
//
// `pathwayIds` (optional, default [] — backward-compatible for CreateCompetitionPage.jsx, which
// doesn't have this concept) scopes which of the curriculum's pathways are offered for pricing
// here — a bootcamp's own choice of which pathways it actually runs (see
// CreateBootcampPage.jsx's PathwaysField). Empty means "every pathway", same as before this prop
// existed. A course that only belongs to an unselected pathway is left out entirely, including
// from the "Other courses" fallback — there's no pathway left to attribute it to, mirroring the
// server's resolveCoursePricing.
export default function CoursePricingField({ curriculumId, pathwayIds = [], value = [], onChange, color = "#25476a", disabled = false }) {
  const { data: courses, isLoading: loadingCourses } = useCurriculumCourses(curriculumId);
  const { data: allPathways, isLoading: loadingPathways } = usePathways(curriculumId);
  const scoped = (pathwayIds || []).length > 0;
  const pathways = scoped ? (allPathways || []).filter((p) => pathwayIds.includes(p.id)) : allPathways;

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
  // When scoped to specific pathways, a course outside every selected pathway has no pathway
  // left to attribute it to here — leave it out entirely rather than surfacing it as "Other".
  const ungrouped = scoped ? [] : allCourses.filter((c) => !groupedCourseIds.has(c.id));

  if (allCourses.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>
        This curriculum has no courses linked yet — add courses to it before pricing them here.
      </p>
    );
  }

  if (scoped && groups.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>
        The selected pathway(s) have no courses to price yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: disabled ? 0.55 : 1 }}>
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
          disabled={disabled}
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
          disabled={disabled}
        />
      )}
    </div>
  );
}

function CourseGroup({ title, accent, courseIds, courseById, priceById, setPrice, removePrice, disabled = false }) {
  return (
    <div>
      {title && (
        <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {title}
        </h4>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {courseIds.map((courseId) => (
          <CourseRow
            key={courseId}
            course={courseById[courseId]}
            price={priceById[courseId]}
            setPrice={setPrice}
            removePrice={removePrice}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function CourseRow({ course, price, setPrice, removePrice, disabled }) {
  const courseId = course.id;
  const checked = !!price;
  const modulePricing = price?.modulePricing || [];
  // Whether this course is currently in "price by module" mode is its own explicit state, NOT
  // derived from modulePricing.length — an admin switching to module pricing starts with zero
  // modules picked yet, and if the mode were derived from array length it would snap straight
  // back to whole-course pricing the instant it's empty (same trap the bootcamp-level
  // pricingMode toggle in CreateBootcampPage.jsx hit and fixed the same way). Seeded from
  // whether the loaded value already has module prices (editing an existing bootcamp), then
  // fully admin-controlled.
  const [byModule, setByModule] = useState(modulePricing.length > 0);
  // Modules are fetched lazily (only once this course is checked on) rather than for every
  // course in the curriculum up front — see CoursePricingField.jsx's own header comment; most
  // courses never get expanded to per-module pricing, so there's no reason to pay for that
  // fetch until an admin actually opens it.
  const { data: modules, isLoading: loadingModules } = useModules(checked ? courseId : null);

  const setCoursePrice = (patch) => setPrice(courseId, patch);

  const switchToModulePricing = () => {
    setByModule(true);
    setCoursePrice({ priceAmount: null });
  };
  const switchToCoursePricing = () => {
    setByModule(false);
    setCoursePrice({ modulePricing: [] });
  };

  const setModulePrice = (moduleId, patch) => {
    const existing = modulePricing.find((m) => m.moduleId === moduleId) || { moduleId, priceAmount: null, priceCurrency: "KES" };
    const next = { ...existing, ...patch };
    setCoursePrice({ modulePricing: [...modulePricing.filter((m) => m.moduleId !== moduleId), next] });
  };
  const toggleModule = (moduleId, isOn) => {
    if (isOn) setModulePrice(moduleId, {});
    else setCoursePrice({ modulePricing: modulePricing.filter((m) => m.moduleId !== moduleId) });
  };

  return (
    <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, backgroundColor: checked ? "#F9FAFB" : "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.checked) setPrice(courseId, {});
            else removePrice(courseId);
          }}
          style={{ width: 15, height: 15, flexShrink: 0, cursor: disabled ? "not-allowed" : "pointer" }}
        />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {course.name}
        </span>
        {checked && !byModule && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            <input
              value={price.priceCurrency ?? "KES"}
              disabled={disabled}
              onChange={(e) => setCoursePrice({ priceCurrency: e.target.value })}
              style={{ width: 56, padding: "6px 8px", borderRadius: 6, border: "1.5px solid #E5E7EB", fontSize: 12.5, fontFamily: "Inter, sans-serif" }}
              aria-label={`Currency for ${course.name}`}
            />
            <input
              type="number"
              min="0"
              value={price.priceAmount ?? ""}
              disabled={disabled}
              onChange={(e) => setCoursePrice({ priceAmount: e.target.value === "" ? null : Number(e.target.value) })}
              style={{ width: 100, padding: "6px 8px", borderRadius: 6, border: "1.5px solid #E5E7EB", fontSize: 12.5, fontFamily: "Inter, sans-serif" }}
              placeholder="Price"
              aria-label={`Price for ${course.name}`}
            />
          </div>
        )}
        {checked && (
          <button
            type="button"
            disabled={disabled}
            onClick={byModule ? switchToCoursePricing : switchToModulePricing}
            style={{
              flexShrink: 0, padding: "5px 9px", borderRadius: 6, border: "1.5px solid #E5E7EB",
              backgroundColor: "#fff", color: "#25476a", fontSize: 11.5, fontWeight: 600,
              fontFamily: "Inter, sans-serif", cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            }}
          >
            {byModule ? "Price whole course" : "Price by module"}
          </button>
        )}
      </div>

      {checked && byModule && (
        <div style={{ padding: "0 10px 10px 33px", display: "flex", flexDirection: "column", gap: 6 }}>
          {loadingModules && <span style={{ fontSize: 12, color: "#9CA3AF" }}>Loading modules…</span>}
          {!loadingModules && (modules || []).length === 0 && (
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>This course has no modules yet.</span>
          )}
          {!loadingModules && (modules || []).length === 1 && (
            <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>This course only has one module — pricing it here is the same as pricing the whole course.</span>
          )}
          {(modules || []).map((mod) => {
            const modPrice = modulePricing.find((m) => m.moduleId === mod.id);
            const modChecked = !!modPrice;
            return (
              <div key={mod.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={modChecked}
                  disabled={disabled}
                  onChange={(e) => toggleModule(mod.id, e.target.checked)}
                  style={{ width: 13, height: 13, flexShrink: 0, cursor: disabled ? "not-allowed" : "pointer" }}
                />
                <span style={{ flex: 1, fontSize: 12.5, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {mod.name}
                </span>
                {modChecked && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <input
                      value={modPrice.priceCurrency ?? "KES"}
                      disabled={disabled}
                      onChange={(e) => setModulePrice(mod.id, { priceCurrency: e.target.value })}
                      style={{ width: 50, padding: "5px 6px", borderRadius: 6, border: "1.5px solid #E5E7EB", fontSize: 12, fontFamily: "Inter, sans-serif" }}
                      aria-label={`Currency for ${mod.name}`}
                    />
                    <input
                      type="number"
                      min="0"
                      value={modPrice.priceAmount ?? ""}
                      disabled={disabled}
                      onChange={(e) => setModulePrice(mod.id, { priceAmount: e.target.value === "" ? null : Number(e.target.value) })}
                      style={{ width: 90, padding: "5px 6px", borderRadius: 6, border: "1.5px solid #E5E7EB", fontSize: 12, fontFamily: "Inter, sans-serif" }}
                      placeholder="Price"
                      aria-label={`Price for ${mod.name}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
