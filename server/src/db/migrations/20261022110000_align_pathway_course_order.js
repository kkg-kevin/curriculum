// A pathway's course order used to live in two places that could disagree: its `courses` list,
// and the `order` of its course bands (performance_bands with pathwayId + courseId), which is
// what a learner advances along. The Pathways tab showed the band order first, then any courses
// with no band yet — and its up/down arrows never saved anything (they sent course ids where
// band ids were expected).
//
// From now on the `courses` list is the order, and the bands are renumbered to follow it (see
// CompetencyService.reorderPathwayCourses / PerformanceBandModel.syncPathwayOrder). This brings
// existing pathways into line with exactly what the tab showed before, so nothing visibly moves:
// courses = banded courses in band order, then the rest in their saved order; each band's order =
// its course's position. Bands for a course no longer on the pathway go after all of them.
//
// Data only, no schema change; down is a no-op (the previous ordering was never meant to differ).
const parse = (value) => {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || "[]") || []; } catch { return []; }
};

exports.up = async function up(knex) {
  const pathways = await knex("pathways").select("id", "curriculumId", "courses");
  for (const pathway of pathways) {
    const courses = parse(pathway.courses);
    const bands = await knex("performance_bands")
      .where({ curriculumId: pathway.curriculumId, pathwayId: pathway.id })
      .whereNotNull("courseId")
      .orderBy("order", "asc")
      .select("id", "courseId", "order");
    if (!bands.length) continue;

    const banded = bands.map((b) => b.courseId).filter((id, i, all) => courses.includes(id) && all.indexOf(id) === i);
    const ordered = [...banded, ...courses.filter((id) => !banded.includes(id))];
    if (ordered.some((id, i) => id !== courses[i])) {
      await knex("pathways").where({ id: pathway.id }).update({ courses: JSON.stringify(ordered) });
    }
    for (let i = 0; i < bands.length; i += 1) {
      const position = ordered.indexOf(bands[i].courseId);
      const order = position >= 0 ? position + 1 : ordered.length + i + 1;
      if (order !== bands[i].order) await knex("performance_bands").where({ id: bands[i].id }).update({ order });
    }
  }
};

exports.down = async function down() {};
