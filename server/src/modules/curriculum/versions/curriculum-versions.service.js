const CurriculumVersionModel = require("./curriculum-versions.model");
const CourseModel            = require("../../courses/course.model");
const CurriculumService      = require("../curriculum.service");

// Every course id assigned anywhere in a version's content (any period, any grade).
function collectCourseIds(content) {
  const ids = new Set();
  (content || []).forEach((period) => {
    (period.classes || []).forEach((cls) => {
      (cls.courses || []).forEach((c) => ids.add(c.id));
    });
  });
  return ids;
}

function buildContentScaffold(curriculum) {
  const periods = curriculum.periods || [];

  // Collect unique grade names from curriculum.structure
  const gradesMap = new Map();
  (curriculum.structure || []).forEach((term) => {
    (term.grades || []).forEach((g) => {
      const key = g.id || g.name;
      if (key && !gradesMap.has(key)) gradesMap.set(key, g.name || g);
    });
  });
  let gradeNames = [...gradesMap.values()];
  // Fall back to legacy curriculum.classes if structure has no grades
  if (gradeNames.length === 0) gradeNames = curriculum.classes || [];

  return periods.map((p) => ({
    periodName: p.name,
    classes: gradeNames.map((name) => ({ className: name, courses: [] })),
  }));
}

const CurriculumVersionService = {
  getAllForCurriculum(curriculumId) {
    const all     = CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    // published (isCurrent) version is the "current"; everything else is history
    const current = all.find((v) => v.isCurrent) || null;
    const history = all.filter((v) => !v.isCurrent);
    return { current, history };
  },

  create(curriculumId, curriculum, data) {
    const existing    = CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    const nextVersion = existing.length ? Math.max(...existing.map((v) => v.versionNumber)) + 1 : 1;

    // New versions are always created as drafts — user explicitly publishes
    const scaffold = buildContentScaffold(curriculum);
    const content  = (data.content && data.content.length)
      ? scaffold.map((sp) => {
          const provided = data.content.find((p) => p.periodName === sp.periodName);
          return provided
            ? { ...sp, classes: sp.classes.map((sc) => { const pc = provided.classes?.find((c) => c.className === sc.className); return pc || sc; }) }
            : sp;
        })
      : scaffold;

    const version = CurriculumVersionModel.create({
      curriculumId,
      academicYearId: data.academicYearId || null,
      versionNumber:  nextVersion,
      status:         "draft",
      isCurrent:      false,
      versionOf:      null,
      content,
    });

    // Every course assigned anywhere in this new version — draft or not — adopts its
    // competencies/learning areas into the curriculum too, same as attaching a course
    // directly (see CurriculumService.autoPopulateFromCourse). Runs on creation rather
    // than waiting for publish, so the curriculum reflects a version as soon as it's built.
    collectCourseIds(content).forEach((courseId) => CurriculumService.autoPopulateFromCourse(curriculumId, courseId));

    return version;
  },

  edit(curriculumId, versionId, data) {
    const version = CurriculumVersionModel.findById(versionId);
    if (!version || version.curriculumId !== curriculumId) {
      throw Object.assign(new Error("Version not found"), { statusCode: 404 });
    }
    return CurriculumVersionModel.update(versionId, {
      status:  data.status  || version.status,
      content: data.content || version.content || [],
    });
  },

  changeStatus(curriculumId, versionId, status) {
    if (!["draft", "published", "inactive"].includes(status)) {
      throw Object.assign(new Error("Invalid status"), { statusCode: 400 });
    }
    if (status === "published") {
      // Retire every other published/current version for this curriculum
      const all = CurriculumVersionModel.findAllByCurriculumId(curriculumId);
      all.forEach((v) => {
        if (v.id !== versionId && (v.isCurrent || v.status === "published")) {
          CurriculumVersionModel.update(v.id, { status: "inactive", isCurrent: false });
        }
      });
      const published = CurriculumVersionModel.update(versionId, { status: "published", isCurrent: true });

      // Also re-run on publish (in addition to on create) — cheap and idempotent, and
      // covers a version published a while after it was first drafted.
      collectCourseIds(published.content).forEach((courseId) => CurriculumService.autoPopulateFromCourse(curriculumId, courseId));

      return published;
    }
    // draft / inactive — clear isCurrent; if this was the live version a new publish is needed
    return CurriculumVersionModel.update(versionId, { status, isCurrent: false });
  },

  // The courses actually visible to learners/teachers — read from the live (isCurrent)
  // version's content, not the separate flat course-curriculum link. Optionally scoped to
  // one grade (className), since the version matrix assigns courses per period+grade and a
  // grade shouldn't see courses assigned only to a different one. Merges across every period
  // (there's no reliable "current term" signal — period dates are optional/often unset).
  getCurrentCourses(curriculumId, gradeName) {
    const current = CurriculumVersionModel.findAllByCurriculumId(curriculumId).find((v) => v.isCurrent);
    if (!current) return [];

    let content = current.content || [];
    if (gradeName) {
      content = content.map((period) => ({
        ...period,
        classes: (period.classes || []).filter((cls) => cls.className === gradeName),
      }));
    }

    return [...collectCourseIds(content)].map((id) => CourseModel.findById(id)).filter(Boolean);
  },
};

module.exports = CurriculumVersionService;
