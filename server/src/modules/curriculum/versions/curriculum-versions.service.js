const CurriculumVersionModel = require("./curriculum-versions.model");
const CourseModel            = require("../../courses/course.model");
const SessionModel           = require("../../courses/session.model");
const CurriculumService      = require("../curriculum.service");
const { collectCourseIds }   = require("./content.utils");

function buildContentScaffold(curriculum) {
  const periods = curriculum.periods || [];
  const classes = curriculum.classes || [];

  return periods.map((p) => ({
    periodName: p.name,
    classes: classes.map((c) => ({ classId: c.id, className: c.name, courses: [] })),
  }));
}

const CurriculumVersionService = {
  async getAllForCurriculum(curriculumId) {
    const all     = await CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    // published (isCurrent) version is the "current"; everything else is history
    const current = all.find((v) => v.isCurrent) || null;
    const history = all.filter((v) => !v.isCurrent);
    return { current, history };
  },

  async create(curriculumId, curriculum, data) {
    const existing    = await CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    const nextVersion = existing.length ? Math.max(...existing.map((v) => v.versionNumber)) + 1 : 1;

    // New versions are always created as drafts — user explicitly publishes
    const scaffold = buildContentScaffold(curriculum);
    const content  = (data.content && data.content.length)
      ? scaffold.map((sp) => {
          const provided = data.content.find((p) => p.periodName === sp.periodName);
          return provided
            ? { ...sp, classes: sp.classes.map((sc) => { const pc = provided.classes?.find((c) => c.classId === sc.classId); return pc || sc; }) }
            : sp;
        })
      : scaffold;

    const version = await CurriculumVersionModel.create({
      curriculumId,
      academicYearId: data.academicYearId || null,
      versionNumber:  nextVersion,
      status:         "draft",
      isCurrent:      false,
      versionOf:      null,
      content,
    });

    // Every course assigned anywhere in this new version — draft or not — adopts its
    // competencies/pathways into the curriculum too, same as attaching a course
    // directly (see CurriculumService.autoPopulateFromCourse). Runs on creation rather
    // than waiting for publish, so the curriculum reflects a version as soon as it's built.
    await Promise.all([...collectCourseIds(content)].map((courseId) => CurriculumService.autoPopulateFromCourse(curriculumId, courseId)));

    return version;
  },

  async edit(curriculumId, versionId, data) {
    const version = await CurriculumVersionModel.findById(versionId);
    if (!version || version.curriculumId !== curriculumId) {
      throw Object.assign(new Error("Version not found"), { statusCode: 404 });
    }
    const updated = await CurriculumVersionModel.update(versionId, {
      status:  data.status  || version.status,
      content: data.content || version.content || [],
    });

    // A course newly placed into this version's content (draft or otherwise) adopts its
    // competencies/pathways right away too — not just at create/publish time (see
    // CurriculumService.autoPopulateFromCourse). Idempotent, so re-running for courses
    // already adopted is a harmless no-op.
    await Promise.all([...collectCourseIds(updated.content)].map((courseId) => CurriculumService.autoPopulateFromCourse(curriculumId, courseId)));

    return updated;
  },

  async changeStatus(curriculumId, versionId, status) {
    if (!["draft", "published", "inactive"].includes(status)) {
      throw Object.assign(new Error("Invalid status"), { statusCode: 400 });
    }
    if (status === "published") {
      // Retire every other published/current version for this curriculum
      const all = await CurriculumVersionModel.findAllByCurriculumId(curriculumId);
      await Promise.all(all.map((v) => {
        if (v.id !== versionId && (v.isCurrent || v.status === "published")) {
          return CurriculumVersionModel.update(v.id, { status: "inactive", isCurrent: false });
        }
        return null;
      }));
      const published = await CurriculumVersionModel.update(versionId, { status: "published", isCurrent: true });

      // Also re-run on publish (in addition to on create) — cheap and idempotent, and
      // covers a version published a while after it was first drafted.
      await Promise.all([...collectCourseIds(published.content)].map((courseId) => CurriculumService.autoPopulateFromCourse(curriculumId, courseId)));

      return published;
    }
    // draft / inactive — clear isCurrent; if this was the live version a new publish is needed
    return CurriculumVersionModel.update(versionId, { status, isCurrent: false });
  },

  // The courses actually visible to learners/teachers — read from the live (isCurrent)
  // version's content, not the separate flat course-curriculum link. Optionally scoped to
  // one grade (classId), since the version matrix assigns courses per period+grade and a
  // grade shouldn't see courses assigned only to a different one. Merges across every period
  // (there's no reliable "current term" signal — period dates are optional/often unset).
  async getCurrentCourses(curriculumId, gradeId) {
    const all = await CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    const current = all.find((v) => v.isCurrent);
    if (!current) return [];

    let content = current.content || [];
    if (gradeId) {
      content = content.map((period) => ({
        ...period,
        classes: (period.classes || []).filter((cls) => cls.classId === gradeId),
      }));
    }

    const courseIds = [...collectCourseIds(content)];
    const countByCourseId = new Map();
    const sessions = await SessionModel.findByCourseIds(courseIds);
    sessions.forEach((s) => countByCourseId.set(s.courseId, (countByCourseId.get(s.courseId) || 0) + 1));

    const courses = await Promise.all(courseIds.map((id) => CourseModel.findById(id)));
    return courses
      .filter(Boolean)
      .map((course) => ({ ...course, sessionCount: countByCourseId.get(course.id) || 0 }));
  },
};

module.exports = CurriculumVersionService;
