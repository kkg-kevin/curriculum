const crypto = require("crypto");
const CourseModel = require("./course.model");
const SessionModel = require("./session.model");
const ModuleModel = require("./module.model");
const CourseCompetencyLinkModel = require("./course-competency-link.model");
const CompetencyModel = require("../settings/competencies/competency.model");
const CourseLearningAreaLinkModel = require("./course-learning-area-link.model");
const LearningAreaModel = require("../settings/learning-areas/learning-area.model");
const CourseCurriculumLinkModel = require("./course-curriculum-link.model");
const CourseInventoryLinkModel = require("./course-inventory-link.model");
const InventoryModel = require("../settings/inventory/inventory.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const CurriculumService = require("../curriculum/curriculum.service");
const AssessmentModel = require("../assessments/assessment.model");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");
const { computeEntryMarks } = require("../assessments/assessment.utils");
const EvidenceTypeModel = require("../curriculum/competency-framework/evidence-type.model");
const AssessmentTypeModel = require("../curriculum/competency-framework/assessment-type.model");
const { normalizeAssessmentAttachments, sessionHasAssessment } = require("./sessionAssessment.utils");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Derives a short uppercase code from a name's word initials (or the first few letters of a
// single word), then disambiguates against codes already in use by appending "-2", "-3", etc.
// Mirrors the client-side generator used by the create form (learningHub.schema.js's
// generateHubCode) — needed here too since duplicateCourse has no separate form step to
// generate one on.
function generateCourseCode(name, existingCodes = []) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const base = (
    words.length === 1 ? words[0].slice(0, 3) : words.map((w) => w[0]).join("").slice(0, 4)
  ).toUpperCase();

  const taken = new Set(existingCodes.filter(Boolean).map((c) => c.toUpperCase()));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// Same disambiguation shape as generateCourseCode above, but for the name — only duplicateCourse
// calls this (createCourse's name is user-typed, so a clash is rejected outright by
// assertUniqueName below rather than silently renamed).
function generateCourseName(name, existingNames = []) {
  const taken = new Set(existingNames.filter(Boolean).map((n) => n.trim().toLowerCase()));
  if (!taken.has(`${name} (Copy)`.toLowerCase())) return `${name} (Copy)`;
  let n = 2;
  while (taken.has(`${name} (Copy ${n})`.toLowerCase())) n++;
  return `${name} (Copy ${n})`;
}

// Cross-field check — zod validates each bound independently, but "max < min" can
// only be caught once both values are known together.
function assertValidAgeRange(ageMin, ageMax) {
  if (ageMin != null && ageMax != null && ageMax < ageMin) {
    const err = new Error("Max age must be greater than or equal to min age");
    err.statusCode = 400;
    throw err;
  }
}

// Courses have no DB-level unique constraint on name (same posture as every other table in
// this codebase — integrity is enforced at the app layer). Case/whitespace-insensitive so
// "Reading Basics" and "reading basics " are still caught as the same course. Only guards
// createCourse — duplicateCourse deliberately reuses the source's exact name on purpose.
async function assertUniqueName(name) {
  const courses = await CourseModel.findAll();
  const normalized = name.trim().toLowerCase();
  const clash = courses.find((c) => c.name.trim().toLowerCase() === normalized);
  if (clash) {
    const err = new Error(`A course named "${clash.name}" already exists — please choose a different name.`);
    err.statusCode = 409;
    throw err;
  }
}

// Every session must belong to a module — no "ungrouped" sessions. Self-healing rather than
// a hard schema constraint: called from both getModules/getSessions so whichever resolves
// first fixes up any orphans (a session with no moduleId, or one pointing at a module that no
// longer exists) before either query returns, keeping both queries consistent on first load.
// Legacy courses that never used modules land here too — a course with sessions always ends
// up with at least a "Module 1" holding them.
async function ensureSessionsGrouped(courseId) {
  const sessions = await SessionModel.findByCourseId(courseId);
  const modules = await ModuleModel.findByCourseId(courseId);
  const moduleIds = new Set(modules.map((m) => m.id));
  const orphans = sessions.filter((s) => !s.moduleId || !moduleIds.has(s.moduleId));
  if (orphans.length === 0) return;

  const targetModuleId = modules.length > 0
    ? modules[0].id
    : (await ModuleModel.create({ courseId, name: "Module 1", order: 1 })).id;

  await Promise.all(orphans.map((s) => SessionModel.update(s.id, { moduleId: targetModuleId })));
}

async function buildAssessmentLookup() {
  const assessments = await AssessmentModel.findAll();
  return new Map(assessments.map((assessment) => [assessment.id, assessment]));
}

// visibleKeys is null for a teacher/admin/school caller (sees everything attached, since they
// decide what to issue) or a Set of "assessmentId:sessionId" for a learner caller (sees only
// what's actually been issued to them — see getIssuedSessionAssessmentKeysForLearner).
function hydrateSessionAssessments(session, assessmentsById, visibleKeys = null) {
  const attachedAssessments = normalizeAssessmentAttachments(session)
    .map((attachment) => {
      const assessment = assessmentsById.get(attachment.assessmentId);
      if (!assessment) return null;
      if (visibleKeys && !visibleKeys.has(`${attachment.assessmentId}:${session.id}`)) return null;
      return { ...assessment, mode: attachment.mode };
    })
    .filter(Boolean);

  return { ...session, attachedAssessments };
}

const CourseService = {
  async createCourse(data) {
    assertValidAgeRange(data.ageMin, data.ageMax);
    await assertUniqueName(data.name);
    return CourseModel.create(data);
  },

  async getAllCourses() {
    const countByCourseId = new Map();
    const sessions = await SessionModel.findAll();
    sessions.forEach((s) => countByCourseId.set(s.courseId, (countByCourseId.get(s.courseId) || 0) + 1));
    const courses = await CourseModel.findAll();
    return courses.map((course) => ({
      ...course,
      sessionCount: countByCourseId.get(course.id) || 0,
    }));
  },

  async getCourseById(id) {
    const course = await CourseModel.findById(id);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    return course;
  },

  async updateCourse(id, data) {
    const existing = await CourseModel.findById(id);
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
    const deleted = await CourseModel.delete(id);
    if (!deleted) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    await SessionModel.deleteByCourseId(id);
    await ModuleModel.deleteByCourseId(id);
    await CourseCompetencyLinkModel.deleteByCourseId(id);
    await CourseLearningAreaLinkModel.deleteByCourseId(id);
    await CourseCurriculumLinkModel.deleteByCourseId(id);
    await CourseInventoryLinkModel.deleteByCourseId(id);
    return { message: "Course deleted successfully" };
  },

  // Deep-clones a course: the record itself, its learning-area/competency tags, and every
  // module + session (fresh ids throughout, since sessions hold the actual authored content).
  // Curriculum links are deliberately NOT copied — the duplicate starts unattached as a Draft,
  // so it never silently double-books a curriculum the original is already used in. The admin
  // decides where (if anywhere) the copy gets attached.
  async duplicateCourse(id) {
    const source = await CourseModel.findById(id);
    if (!source) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }

    const allCourses = await CourseModel.findAll();
    const existingCodes = allCourses.map((c) => c.code).filter(Boolean);
    const existingNames = allCourses.map((c) => c.name).filter(Boolean);
    const { id: _id, createdAt, updatedAt, code, status, ...rest } = source;
    const newCourse = await CourseModel.create({
      ...rest,
      name: generateCourseName(source.name, existingNames),
      code: generateCourseCode(source.name, existingCodes),
      status: "draft",
    });

    const learningAreaLinks = await CourseLearningAreaLinkModel.findByCourseId(id);
    await Promise.all(learningAreaLinks.map((l) => CourseLearningAreaLinkModel.link(newCourse.id, l.learningAreaId)));
    const competencyLinks = await CourseCompetencyLinkModel.findByCourseId(id);
    await Promise.all(competencyLinks.map((l) => CourseCompetencyLinkModel.link(newCourse.id, l.competencyId)));

    const moduleIdMap = new Map();
    const modules = await ModuleModel.findByCourseId(id);
    for (const m of modules) {
      const { id: oldModuleId, courseId: _courseId, createdAt: _c, updatedAt: _u, ...moduleRest } = m;
      const newModule = await ModuleModel.create({ ...moduleRest, courseId: newCourse.id });
      moduleIdMap.set(oldModuleId, newModule.id);
    }

    const regenerateItemIds = (items = []) => items.map((item) => ({ ...item, id: generateId() }));
    const sourceSessions = await SessionModel.findByCourseId(id);
    const sessionsData = sourceSessions.map((s) => {
      const { id: _sessionId, courseId: _courseId, createdAt: _c, updatedAt: _u, ...sessionRest } = s;
      return {
        ...sessionRest,
        courseId: newCourse.id,
        moduleId: s.moduleId ? (moduleIdMap.get(s.moduleId) || null) : null,
        mainConcepts: regenerateItemIds(s.mainConcepts),
        activities: regenerateItemIds(s.activities),
        notes: regenerateItemIds(s.notes),
        resources: regenerateItemIds(s.resources),
      };
    });
    if (sessionsData.length > 0) await SessionModel.createMany(sessionsData);

    return newCourse;
  },

  /* ── Competencies (authored globally in Settings, tagged onto a course here) ── */

  async getCourseCompetencies(courseId) {
    const links = await CourseCompetencyLinkModel.findByCourseId(courseId);
    return CompetencyModel.findByIds(links.map((l) => l.competencyId));
  },

  async linkCompetency(courseId, competencyId) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const comp = await CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    await CourseCompetencyLinkModel.link(courseId, competencyId);
    return this.getCourseCompetencies(courseId);
  },

  async unlinkCompetency(courseId, competencyId) {
    await CourseCompetencyLinkModel.unlink(courseId, competencyId);
    return this.getCourseCompetencies(courseId);
  },

  /* ── Learning Areas (authored globally in Settings, tagged onto a course here) ── */

  async getCourseLearningAreas(courseId) {
    const links = await CourseLearningAreaLinkModel.findByCourseId(courseId);
    return LearningAreaModel.findByIds(links.map((l) => l.learningAreaId));
  },

  async linkLearningArea(courseId, learningAreaId) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const area = await LearningAreaModel.findById(learningAreaId);
    if (!area) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    await CourseLearningAreaLinkModel.link(courseId, learningAreaId);
    // Live-sync: any curriculum this course is already in picks up the new learning area
    // immediately, no re-attach/republish needed.
    await CurriculumService.resyncCourseIntoCurricula(courseId);
    return this.getCourseLearningAreas(courseId);
  },

  async unlinkLearningArea(courseId, learningAreaId) {
    await CourseLearningAreaLinkModel.unlink(courseId, learningAreaId);
    return this.getCourseLearningAreas(courseId);
  },

  /* ── Inventory (authored globally in Settings, linked onto a course with a quantity) —
     same pattern as a Project assessment's own inventory links, see
     assessment.service.js's getAssessmentInventory/linkInventoryItem/unlinkInventoryItem ── */

  async getCourseInventory(courseId) {
    const links = await CourseInventoryLinkModel.findByCourseId(courseId);
    const items = await InventoryModel.findByIds(links.map((l) => l.inventoryItemId));
    const itemsById = new Map(items.map((i) => [i.id, i]));
    return links
      .map((link) => {
        const item = itemsById.get(link.inventoryItemId);
        return item ? { ...item, quantity: link.quantity } : null;
      })
      .filter(Boolean);
  },

  async linkInventoryItem(courseId, inventoryItemId, quantity) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const item = await InventoryModel.findById(inventoryItemId);
    if (!item) {
      const err = new Error("Inventory item not found");
      err.statusCode = 404;
      throw err;
    }
    await CourseInventoryLinkModel.link(courseId, inventoryItemId, quantity);
    return this.getCourseInventory(courseId);
  },

  async unlinkInventoryItem(courseId, inventoryItemId) {
    await CourseInventoryLinkModel.unlink(courseId, inventoryItemId);
    return this.getCourseInventory(courseId);
  },

  /* ── Curricula (a course stays independent — this just records where it's currently used) ── */

  async getCourseCurricula(courseId) {
    const links = await CourseCurriculumLinkModel.findByCourseId(courseId);
    const curricula = await Promise.all(links.map((l) => CurriculumModel.findById(l.curriculumId)));
    return curricula.filter(Boolean);
  },

  /* ── Score Evidence resolution ──────────────────────────────────────────
   * A course-attached assessment (referenced via a session's assessmentIds or
   * assessmentAttachments — the session stores the link, not a copy of the assessment)
   * is matched against a linked curriculum's
   * Evidence Types by `category`, so its total marks can be previewed against that
   * curriculum's Score Evidence weighting. No learner score exists yet — this is a
   * preview using the assessment's max marks, not a real result. */

  async getAssessmentScoring(courseId, assessmentId, curriculumId) {
    if (!curriculumId) {
      const err = new Error("curriculumId query parameter is required");
      err.statusCode = 400;
      throw err;
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }

    const sessions = await SessionModel.findByCourseId(courseId);
    const attached = sessions.some((s) => sessionHasAssessment(s, assessmentId));
    if (!attached) {
      const err = new Error("This assessment is not attached to this course");
      err.statusCode = 404;
      throw err;
    }

    const courseCurriculumLinks = await CourseCurriculumLinkModel.findByCourseId(courseId);
    const curriculumLinked = courseCurriculumLinks.some((l) => l.curriculumId === curriculumId);
    if (!curriculumLinked) {
      const err = new Error("This course is not linked to that curriculum");
      err.statusCode = 404;
      throw err;
    }

    const assessment = await AssessmentModel.findById(assessmentId);
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
      (assessment.items  || []).reduce((sum, i) => sum + computeEntryMarks(i), 0) +
      (assessment.rubric || []).reduce((sum, r) => sum + computeEntryMarks(r), 0);

    const evidenceTypes = await EvidenceTypeModel.findByCurriculumId(curriculumId);
    const evidenceType = evidenceTypes.find((e) => e.category === assessment.type);

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
    const assessmentTypes = await AssessmentTypeModel.findByCurriculumId(curriculumId);
    const usedIn = assessmentTypes
      .map((at) => {
        const weight = (at.evidenceWeights || []).find((w) => w.evidenceTypeId === evidenceType.id);
        if (!weight) return null;
        return {
          assessmentTypeId:   at.id,
          assessmentTypeName: at.name,
          contribution:       weight.contribution,
        };
      })
      .filter(Boolean);

    const configs = usedIn.length > 0 ? usedIn : [{
      assessmentTypeId:   null,
      assessmentTypeName: null,
      contribution:       evidenceType.defaultContribution || 0,
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

  // learnerId, when passed, scopes attachedAssessments on every returned session to only what's
  // actually been issued to that learner — see hydrateSessionAssessments. Omitted (the default)
  // for teacher/admin/school callers, who need to see everything attached in order to issue it.
  async getSessions(courseId, { learnerId } = {}) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    await ensureSessionsGrouped(courseId);
    const assessmentsById = await buildAssessmentLookup();
    const sessions = await SessionModel.findByCourseId(courseId);
    const visibleKeys = learnerId
      ? await AssessmentSubmissionService.getIssuedSessionAssessmentKeysForLearner(learnerId)
      : null;
    return sessions.map((session) => hydrateSessionAssessments(session, assessmentsById, visibleKeys));
  },

  async createSession(courseId, data) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const existingSessions = await SessionModel.findByCourseId(courseId);
    const order = data.order ?? existingSessions.length + 1;
    const session = await SessionModel.create({ courseId, ...data, order });
    // Live-sync: a session created with assessments already attached feeds this course's
    // curricula immediately, same as attaching them via a later update.
    if (data.assessmentIds?.length || data.assessmentAttachments?.length) await CurriculumService.resyncCourseIntoCurricula(courseId);
    const assessmentsById = await buildAssessmentLookup();
    return hydrateSessionAssessments(session, assessmentsById);
  },

  async createSessionsBulk(courseId, count, moduleId = null) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const existingSessions = await SessionModel.findByCourseId(courseId);
    const startOrder = existingSessions.length + 1;
    const sessionsData = Array.from({ length: count }, (_, i) => ({
      courseId,
      title: "",
      order: startOrder + i,
      moduleId,
      outcomes: [],
      introduction: "",
      mainConcepts: [{ id: generateId(), title: "Introduction", content: "" }],
      activities: [{ id: generateId(), title: "", content: "", mode: "individual" }],
      notes: [{ id: generateId(), title: "", content: "" }],
      resources: [],
    }));
    const assessmentsById = await buildAssessmentLookup();
    const created = await SessionModel.createMany(sessionsData);
    return created.map((session) => hydrateSessionAssessments(session, assessmentsById));
  },

  async updateSession(courseId, sessionId, data) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const session = await SessionModel.findById(sessionId);
    if (!session || session.courseId !== courseId) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }
    const updated = await SessionModel.update(sessionId, data);
    // Live-sync: an assessment newly attached to this session feeds this course's curricula
    // immediately. No diffing needed — resync is idempotent, so this is a no-op if nothing
    // about assessmentIds actually changed.
    if (data.assessmentIds !== undefined || data.assessmentAttachments !== undefined) await CurriculumService.resyncCourseIntoCurricula(courseId);
    const assessmentsById = await buildAssessmentLookup();
    return hydrateSessionAssessments(updated, assessmentsById);
  },

  async deleteSession(courseId, sessionId) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const session = await SessionModel.findById(sessionId);
    if (!session || session.courseId !== courseId) {
      const err = new Error("Session not found");
      err.statusCode = 404;
      throw err;
    }
    await SessionModel.delete(sessionId);
  },

  /* ── Modules (group this course's Sessions under a named bucket) ───────── */

  async getModules(courseId) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    await ensureSessionsGrouped(courseId);
    return ModuleModel.findByCourseId(courseId);
  },

  async createModule(courseId, data) {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    const existingModules = await ModuleModel.findByCourseId(courseId);
    const order = data.order ?? existingModules.length + 1;
    return ModuleModel.create({ courseId, ...data, order });
  },

  async updateModule(courseId, moduleId, data) {
    const courseModule = await ModuleModel.findById(moduleId);
    if (!courseModule || courseModule.courseId !== courseId) {
      const err = new Error("Module not found");
      err.statusCode = 404;
      throw err;
    }
    return ModuleModel.update(moduleId, data);
  },

  async deleteModule(courseId, moduleId) {
    const courseModule = await ModuleModel.findById(moduleId);
    if (!courseModule || courseModule.courseId !== courseId) {
      const err = new Error("Module not found");
      err.statusCode = 404;
      throw err;
    }
    // Every session must belong to a module — no "ungrouped" fallback — so a module can
    // only be deleted once it's empty. Move or delete its sessions first.
    const sessions = await SessionModel.findByCourseId(courseId);
    const hasSessions = sessions.some((s) => s.moduleId === moduleId);
    if (hasSessions) {
      const err = new Error(`"${courseModule.name}" still has sessions in it. Move or delete them before deleting this module.`);
      err.statusCode = 400;
      throw err;
    }
    await ModuleModel.delete(moduleId);
  },
};

module.exports = CourseService;
