// The filter bar's choices: the hubs (workspace view), and the curricula, classes, courses,
// stages and pathways in them. Each class carries its hub and curriculum, each stage and pathway
// its curriculum, so the page narrows the lists as filters are picked.

const db = require("../../config/db");
const { inChunks } = require("./analytics.utils");
const { className } = require("./analytics.scope");

async function getFilters(scope) {
  const curriculumIds = [...new Set(scope.classes.map((c) => c.curriculumId).filter(Boolean))];
  const curricula = curriculumIds.length ? await db("curricula").whereIn("id", curriculumIds).select("id", "name") : [];

  const links = await inChunks(scope.classIds, (ids) => db("class_course_teacher_links").whereIn("classId", ids).select("classId", "courseId"));
  const issued = await inChunks(scope.classIds, (ids) => db("assessment_issues").whereIn("classId", ids).whereNotNull("courseId").distinct("classId", "courseId"));
  const classesByCourse = new Map();
  for (const l of [...links, ...issued]) {
    if (!l.courseId) continue;
    (classesByCourse.get(l.courseId) || classesByCourse.set(l.courseId, new Set()).get(l.courseId)).add(l.classId);
  }
  const courses = await inChunks([...classesByCourse.keys()], (ids) => db("courses").whereIn("id", ids).select("id", "name"));

  const stages = curriculumIds.length ? await db("age_categories").whereIn("curriculumId", curriculumIds).select("id", "name", "curriculumId", "order").orderBy("order") : [];
  const pathways = curriculumIds.length ? await db("pathways").whereIn("curriculumId", curriculumIds).select("name", "curriculumId") : [];
  const pathwayNames = new Map();
  for (const p of pathways) (pathwayNames.get(p.name) || pathwayNames.set(p.name, new Set()).get(p.name)).add(p.curriculumId);

  return {
    hubs: scope.isHubView ? [] : scope.hubs.map((h) => ({ id: h.id, name: h.name, status: h.status })).sort((a, b) => a.name.localeCompare(b.name)),
    curricula: curricula.sort((a, b) => a.name.localeCompare(b.name)),
    classes: scope.classes.map((c) => ({ id: c.id, label: className(c), hubId: c.schoolId, curriculumId: c.curriculumId, status: c.status }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    courses: courses.map((c) => ({ id: c.id, name: c.name, classIds: [...classesByCourse.get(c.id)] })).sort((a, b) => a.name.localeCompare(b.name)),
    stages: stages.map((s) => ({ id: s.id, name: s.name, curriculumId: s.curriculumId })),
    pathways: [...pathwayNames.entries()].map(([name, set]) => ({ name, curriculumIds: [...set] })).sort((a, b) => a.name.localeCompare(b.name)),
    isHubView: scope.isHubView,
  };
}

module.exports = { getFilters };
