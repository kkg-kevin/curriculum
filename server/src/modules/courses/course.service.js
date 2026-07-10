const crypto = require("crypto");
const CourseModel = require("./course.model");
const SessionModel = require("./session.model");
const ModuleModel = require("./module.model");
const CourseCompetencyLinkModel = require("./course-competency-link.model");
const CompetencyModel = require("../settings/competencies/competency.model");
const CourseLearningAreaLinkModel = require("./course-learning-area-link.model");
const LearningAreaModel = require("../settings/learning-areas/learning-area.model");
const CourseCurriculumLinkModel = require("./course-curriculum-link.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const AssessmentModel = require("../assessments/assessment.model");
const EvidenceTypeModel = require("../curriculum/competency-framework/evidence-type.model");
const AssessmentTypeModel = require("../curriculum/competency-framework/assessment-type.model");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Cross-field check — zod validates each bound independently, but "max < min" can
// only be caught once both values are known together.
function assertValidAgeRange(ageMin, ageMax) {
  if (ageMin != null && ageMax != null && ageMax < ageMin) {
    const err = new Error("Max age must be greater than or equal to min age");
    err.statusCode = 400;
    throw err;
  }
}

// Every session must belong to a module — no "ungrouped" sessions. Self-healing rather than
// a hard schema constraint: called from both getModules/getSessions so whichever resolves
// first fixes up any orphans (a session with no moduleId, or one pointing at a module that no
// longer exists) before either query returns, keeping both queries consistent on first load.
// Legacy courses that never used modules land here too — a course with sessions always ends
// up with at least a "Module 1" holding them.
function ensureSessionsGrouped(courseId) {
  const sessions = SessionModel.findByCourseId(courseId);
  const modules = ModuleModel.findByCourseId(courseId);
  const moduleIds = new Set(modules.map((m) => m.id));
  const orphans = sessions.filter((s) => !s.moduleId || !moduleIds.has(s.moduleId));
  if (orphans.length === 0) return;

  const targetModuleId = modules.length > 0
    ? modules[0].id
    : ModuleModel.create({ courseId, name: "Module 1", order: 1 }).id;

  orphans.forEach((s) => SessionModel.update(s.id, { moduleId: targetModuleId }));
}

const CourseService = {
  async createCourse(data) {
    assertValidAgeRange(data.ageMin, data.ageMax);
    return CourseModel.create(data);
  },

  async getAllCourses() {
    const countByCourseId = new Map();
    SessionModel.findAll().forEach((s) => countByCourseId.set(s.courseId, (countByCourseId.get(s.courseId) || 0) + 1));
    return CourseModel.findAll().map((course) => ({
      ...course,
      sessionCount: countByCourseId.get(course.id) || 0,
    }));
  },

  async getCourseById(id) {
    const course = CourseModel.findById(id);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    return course;
  },

  async updateCourse(id, data) {
    const existing = CourseModel.findById(id);
    if (!existing) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const merged = { ...existing, ...data };
    assertValidAgeRange(merged.ageMin, merged.ageMax);
    return CourseModel.update(id, data);
  },

  async deleteCourse(id) {
    const deleted = CourseModel.delete(id);
    if (!deleted) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    SessionModel.deleteByCourseId(id);
    ModuleModel.deleteByCourseId(id);
    CourseCompetencyLinkModel.deleteByCourseId(id);
    CourseLearningAreaLinkModel.deleteByCourseId(id);
    CourseCurriculumLinkModel.deleteByCourseId(id);
    return { message: "Course deleted successfully" };
  },

  /* ── Competencies (authored globally in Settings, tagged onto a course here) ── */

  async getCourseCompetencies(courseId) {
    const links = CourseCompetencyLinkModel.findByCourseId(courseId);
    return CompetencyModel.findByIds(links.map((l) => l.competencyId));
  },

  async linkCompetency(courseId, competencyId) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const comp = CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    CourseCompetencyLinkModel.link(courseId, competencyId);
    return this.getCourseCompetencies(courseId);
  },

  async unlinkCompetency(courseId, competencyId) {
    CourseCompetencyLinkModel.unlink(courseId, competencyId);
    return this.getCourseCompetencies(courseId);
  },

  /* ── Learning Areas (authored globally in Settings, tagged onto a course here) ── */

  async getCourseLearningAreas(courseId) {
    const links = CourseLearningAreaLinkModel.findByCourseId(courseId);
    return LearningAreaModel.findByIds(links.map((l) => l.learningAreaId));
  },

  async linkLearningArea(courseId, learningAreaId) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const area = LearningAreaModel.findById(learningAreaId);
    if (!area) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    CourseLearningAreaLinkModel.link(courseId, learningAreaId);
    return this.getCourseLearningAreas(courseId);
  },

  async unlinkLearningArea(courseId, learningAreaId) {
    CourseLearningAreaLinkModel.unlink(courseId, learningAreaId);
    return this.getCourseLearningAreas(courseId);
  },

  /* ── Curricula (a course stays independent — this just records where it's currently used) ── */

  async getCourseCurricula(courseId) {
    const links = CourseCurriculumLinkModel.findByCourseId(courseId);
    return links
      .map((l) => CurriculumModel.findById(l.curriculumId))
      .filter(Boolean);
  },

  /* ── Score Evidence resolution ──────────────────────────────────────────
   * A course-attached assessment (referenced via a session's assessmentIds — an
   * assessment is never owned by a course) is matched against a linked curriculum's
   * Evidence Types by `category`, so its total marks can be previewed against that
   * curriculum's Score Evidence weighting. No learner score exists yet — this is a
   * preview using the assessment's max marks, not a real result. */

  async getAssessmentScoring(courseId, assessmentId, curriculumId) {
    if (!curriculumId) {
      const err = new Error("curriculumId query parameter is required");
      err.statusCode = 400;
      throw err;
    }

    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }

    const attached = SessionModel.findByCourseId(courseId)
      .some((s) => (s.assessmentIds || []).includes(assessmentId));
    if (!attached) {
      const err = new Error("This assessment is not attached to this course");
      err.statusCode = 404;
      throw err;
    }

    const curriculumLinked = CourseCurriculumLinkModel.findByCourseId(courseId)
      .some((l) => l.curriculumId === curriculumId);
    if (!curriculumLinked) {
      const err = new Error("This course is not linked to that curriculum");
      err.statusCode = 404;
      throw err;
    }

    const assessment = AssessmentModel.findById(assessmentId);
    if (!assessment) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }

    // Teacher Observation assessments are rating-scale based (checklist/rating/behaviour
    // indicators, no points field) — they have no items or rubric to sum, so a marks total
    // isn't meaningful for this type. Say so explicitly rather than silently returning 0,
    // which would look like a real (and wrong) max score once this preview is wired to a UI.
    if (assessment.type === "observation") {
      return {
        assessmentType: assessment.type,
        totalMarks: null,
        matched: false,
        message: "Teacher Observation assessments are rating-based, not marks-based — Score Evidence scoring isn't available for this type yet.",
      };
    }

    const totalMarks =
      (assessment.items  || []).reduce((sum, i) => sum + (i.points  || 0), 0) +
      (assessment.rubric || []).reduce((sum, r) => sum + (r.points || 0), 0);

    const evidenceType = EvidenceTypeModel.findByCurriculumId(curriculumId)
      .find((e) => e.category === assessment.type);

    if (!evidenceType) {
      return {
        assessmentType: assessment.type,
        totalMarks,
        matched: false,
        message: `This curriculum has no Evidence Type configured for "${assessment.type}" yet.`,
      };
    }

    // The Evidence Type's own defaultContribution is only a starting suggestion — the number
    // that actually governs scoring is whatever a specific Assessment Type overrides it to in
    // its own evidenceWeights. Resolve from there first; only fall back to the default if this
    // evidence type hasn't been wired into any Assessment Type yet. An evidence type can be
    // reused across multiple Assessment Types with different overrides, so return every match
    // rather than silently picking one.
    const usedIn = AssessmentTypeModel.findByCurriculumId(curriculumId)
      .map((at) => {
        const weight = (at.evidenceWeights || []).find((w) => w.evidenceTypeId === evidenceType.id);
        if (!weight) return null;
        return {
          assessmentTypeId:   at.id,
          assessmentTypeName: at.name,
          contribution:       weight.contribution,
          minRequirement:     weight.minRequirement ?? 0,
        };
      })
      .filter(Boolean);

    const configs = usedIn.length > 0 ? usedIn : [{
      assessmentTypeId:   null,
      assessmentTypeName: null,
      contribution:       evidenceType.defaultContribution || 0,
      minRequirement:     evidenceType.minRequirement || 0,
    }];

    const results = configs.map((cfg) => ({
      ...cfg,
      source:       cfg.assessmentTypeId ? "assessmentType" : "default",
      narrowedMarks: Math.round((totalMarks * cfg.contribution) / 100 * 10) / 10,
    }));

    return {
      assessmentType: assessment.type,
      totalMarks,
      matched: true,
      evidenceType: { id: evidenceType.id, name: evidenceType.name },
      results,
    };
  },

  /* ── Sessions ────────────────────────────────────────────────────────── */

  async getSessions(courseId) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    ensureSessionsGrouped(courseId);
    return SessionModel.findByCourseId(courseId);
  },

  async createSession(courseId, data) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const order = data.order ?? SessionModel.findByCourseId(courseId).length + 1;
    return SessionModel.create({ courseId, ...data, order });
  },

  async createSessionsBulk(courseId, count, moduleId = null) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const startOrder = SessionModel.findByCourseId(courseId).length + 1;
    const sessionsData = Array.from({ length: count }, (_, i) => ({
      courseId,
      title: "",
      order: startOrder + i,
      moduleId,
      outcomes: [],
      introduction: "",
      mainConcepts: [{ id: generateId(), title: "Introduction", content: "" }],
      activities: [{ id: generateId(), title: "", content: "" }],
      notes: [{ id: generateId(), title: "", content: "" }],
      resources: [],
    }));
    return SessionModel.createMany(sessionsData);
  },

  async updateSession(courseId, sessionId, data) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const session = SessionModel.findById(sessionId);
    if (!session || session.courseId !== courseId) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }
    return SessionModel.update(sessionId, data);
  },

  async deleteSession(courseId, sessionId) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const session = SessionModel.findById(sessionId);
    if (!session || session.courseId !== courseId) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }
    SessionModel.delete(sessionId);
  },

  /* ── Modules (group this course's Sessions under a named bucket) ───────── */

  async getModules(courseId) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    ensureSessionsGrouped(courseId);
    return ModuleModel.findByCourseId(courseId);
  },

  async createModule(courseId, data) {
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const order = data.order ?? ModuleModel.findByCourseId(courseId).length + 1;
    return ModuleModel.create({ courseId, ...data, order });
  },

  async updateModule(courseId, moduleId, data) {
    const courseModule = ModuleModel.findById(moduleId);
    if (!courseModule || courseModule.courseId !== courseId) {
      const err = new Error("Module not found");
      err.statusCode = 404;
      throw err;
    }
    return ModuleModel.update(moduleId, data);
  },

  async deleteModule(courseId, moduleId) {
    const courseModule = ModuleModel.findById(moduleId);
    if (!courseModule || courseModule.courseId !== courseId) {
      const err = new Error("Module not found");
      err.statusCode = 404;
      throw err;
    }
    // Every session must belong to a module — no "ungrouped" fallback — so a module can
    // only be deleted once it's empty. Move or delete its sessions first.
    const hasSessions = SessionModel.findByCourseId(courseId).some((s) => s.moduleId === moduleId);
    if (hasSessions) {
      const err = new Error(`"${courseModule.name}" still has sessions in it. Move or delete them before deleting this module.`);
      err.statusCode = 400;
      throw err;
    }
    ModuleModel.delete(moduleId);
  },
};

module.exports = CourseService;
