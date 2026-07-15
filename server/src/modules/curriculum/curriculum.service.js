const CurriculumModel          = require("./curriculum.model");
const CourseCurriculumLinkModel = require("../courses/course-curriculum-link.model");
const CourseModel = require("../courses/course.model");
const SessionModel = require("../courses/session.model");
const CourseLearningAreaLinkModel = require("../courses/course-learning-area-link.model");
const AssessmentCompetencyLinkModel = require("../assessments/assessment-competency-link.model");
const CurriculumCompetencyLinkModel = require("./competency-framework/curriculum-competency-link.model");
const LearningAreaModel = require("./competency-framework/learning-area.model");
const LearningAreaCatalogModel = require("../settings/learning-areas/learning-area.model");
const CurriculumCompetencyIndicatorModel = require("./competency-framework/curriculum-competency-indicator.model");
const AgeCategoryModel      = require("./competency-framework/age-category.model");
const ProgressLevelModel    = require("./competency-framework/progress-level.model");
const AssessmentTypeModel   = require("./competency-framework/assessment-type.model");
const EvidenceTypeModel     = require("./competency-framework/evidence-type.model");
const PerformanceBandModel  = require("./competency-framework/performance-band.model");
const ProgressionLadderModel = require("./competency-framework/progression-ladder.model");
const CurriculumAssessmentModel = require("./competency-framework/assessment.model");
const CurriculumVersionModel = require("./versions/curriculum-versions.model");

const CurriculumService = {
  async createCurriculum(data) {
    return CurriculumModel.create(data);
  },

  async getAllCurricula(filters) {
    const curricula = CurriculumModel.findAll(filters);

    const fs   = require("fs");
    const path = require("path");
    const readJ = (f) => { try { const r = fs.readFileSync(f, "utf-8").trim(); return r ? JSON.parse(r) : []; } catch { return []; } };

    const ayGroups    = readJ(path.join(__dirname, "../../../data/academic-year-groups.json"));
    const ayVersions  = readJ(path.join(__dirname, "../../../data/academic-year-versions.json"));
    const cvVersions  = readJ(path.join(__dirname, "../../../data/curriculum-versions.json"));

    // AY label lookup: curriculumId → published year label
    const groupById = Object.fromEntries(ayGroups.map((g) => [g.id, g]));
    const ayLabelByCurriculumId = {};
    for (const v of ayVersions) {
      if (v.status === "published" && v.curriculumId) {
        const group = groupById[v.yearGroupId];
        if (group) ayLabelByCurriculumId[v.curriculumId] = group.label;
      }
    }

    // Effective status: "published" only when BOTH curriculum-version AND academic-year-version are published
    const cvPublishedIds = new Set();
    const cvActiveIds    = new Set();
    // Courses count from the current (isCurrent) version's content
    const coursesCountById = {};
    for (const v of cvVersions) {
      if (!v.curriculumId) continue;
      if (v.status === "published") cvPublishedIds.add(v.curriculumId);
      if (v.status === "active")    cvActiveIds.add(v.curriculumId);
      if (v.isCurrent) {
        let count = 0;
        for (const period of (v.content || [])) {
          for (const cls of (period.classes || [])) {
            count += (cls.courses || []).length;
          }
        }
        coursesCountById[v.curriculumId] = count;
      }
    }

    const ayPublishedIds = new Set();
    for (const v of ayVersions) {
      if (v.curriculumId && v.status === "published") ayPublishedIds.add(v.curriculumId);
    }

    return curricula.map((c) => {
      let effectiveStatus;
      if (cvPublishedIds.has(c.id) && ayPublishedIds.has(c.id)) {
        effectiveStatus = "published";
      } else if (cvActiveIds.has(c.id)) {
        effectiveStatus = "active";
      } else {
        effectiveStatus = c.status || "draft";
      }
      return {
        ...c,
        publishedAcademicYear: ayLabelByCurriculumId[c.id] || null,
        effectiveStatus,
        coursesCount: coursesCountById[c.id] || 0,
      };
    });
  },

  async getCurriculumById(id) {
    const curriculum = CurriculumModel.findById(id);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return curriculum;
  },

  async updateCurriculum(id, data) {
    const curriculum = CurriculumModel.update(id, data);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return curriculum;
  },

  async deleteCurriculum(id) {
    const deleted = CurriculumModel.delete(id);
    if (!deleted) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    CourseCurriculumLinkModel.deleteByCurriculumId(id);
    // Every other piece of the competency framework is scoped to this curriculum and has
    // no life outside it — without this, deleting a curriculum leaves orphaned records
    // behind in every one of these files forever (found via audit — the earlier version of
    // this method only ever cleaned up the course link).
    CurriculumCompetencyLinkModel.deleteByCurriculumId(id);
    CurriculumCompetencyIndicatorModel.deleteByCurriculumId(id);
    LearningAreaModel.deleteByCurriculumId(id);
    AgeCategoryModel.deleteByCurriculumId(id);
    ProgressLevelModel.deleteByCurriculumId(id);
    AssessmentTypeModel.deleteByCurriculumId(id);
    EvidenceTypeModel.deleteByCurriculumId(id);
    PerformanceBandModel.deleteByCurriculumId(id);
    ProgressionLadderModel.deleteByCurriculumId(id);
    CurriculumAssessmentModel.deleteByCurriculumId(id);
    CurriculumVersionModel.deleteByCurriculumId(id);
    return { message: "Curriculum deleted successfully" };
  },

  /* ── Courses (added to this curriculum from here — a course stays independent
   * and reusable otherwise, this just records where it's currently used) ── */

  async getCurriculumCourses(curriculumId) {
    return CourseCurriculumLinkModel.findByCurriculumId(curriculumId)
      .map((l) => CourseModel.findById(l.courseId))
      .filter(Boolean);
  },

  async linkCourse(curriculumId, courseId) {
    const curriculum = CurriculumModel.findById(curriculumId);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    const course = CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    CourseCurriculumLinkModel.link(courseId, curriculumId);
    this.autoPopulateFromCourse(curriculumId, courseId);
    return this.getCurriculumCourses(curriculumId);
  },

  // A course carries competencies (via the assessments attached to its sessions) and
  // learning areas (tagged directly on it). When it's attached to a curriculum, adopt both
  // into the curriculum — a one-time copy taken at attach time, not a live sync: if the
  // course's assessments gain new competency tags afterward, curricula it's already
  // attached to won't pick those up automatically.
  autoPopulateFromCourse(curriculumId, courseId) {
    // Competencies — via every assessment attached to any of this course's sessions.
    const assessmentIds = new Set();
    SessionModel.findByCourseId(courseId).forEach((s) => {
      (s.assessmentIds || []).forEach((aid) => assessmentIds.add(aid));
    });
    const competencyIds = new Set();
    assessmentIds.forEach((aid) => {
      AssessmentCompetencyLinkModel.findByAssessmentId(aid).forEach((l) => competencyIds.add(l.competencyId));
    });
    competencyIds.forEach((competencyId) => CurriculumCompetencyLinkModel.link(curriculumId, competencyId));

    // Learning areas — tagged directly on the course. Cloned into this curriculum's own
    // list on first use (same pattern as CompetencyService.importLearningArea, matched by
    // name to avoid duplicates) — but seeded with just this course, not the global catalog
    // entry's own `courses` list (that's a separate, manually-curated field unrelated to why
    // this area is being adopted here). If the curriculum already has this learning area
    // from an earlier course, this course is appended to it instead of being dropped.
    const areaByName = new Map(
      LearningAreaModel.findByCurriculumId(curriculumId).map((a) => [a.name.toLowerCase(), a])
    );
    CourseLearningAreaLinkModel.findByCourseId(courseId).forEach((link) => {
      const source = LearningAreaCatalogModel.findById(link.learningAreaId);
      if (!source) return;
      const existing = areaByName.get(source.name.toLowerCase());
      if (existing) {
        if (!(existing.courses || []).includes(courseId)) {
          const updated = LearningAreaModel.update(existing.id, { courses: [...(existing.courses || []), courseId] });
          areaByName.set(source.name.toLowerCase(), updated);
        }
      } else {
        const created = LearningAreaModel.create({
          curriculumId,
          name:        source.name,
          description: source.description,
          color:       source.color,
          courses:     [courseId],
        });
        areaByName.set(source.name.toLowerCase(), created);
      }
    });
  },

  async unlinkCourse(curriculumId, courseId) {
    CourseCurriculumLinkModel.unlink(courseId, curriculumId);
    return this.getCurriculumCourses(curriculumId);
  },
};

module.exports = CurriculumService;
