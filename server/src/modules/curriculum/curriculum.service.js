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
const LearnerJourneyModel = require("./competency-framework/learner-journey.model");
const IndicatorAchievementModel = require("./competency-framework/indicator-achievement.model");
const { collectCourseIds } = require("./versions/content.utils");
const { getSessionAssessmentIds, sessionHasAssessment } = require("../courses/sessionAssessment.utils");

function readJsonFile(filePath) {
  try {
    const fs = require("fs");
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function buildCurriculumMeta() {
  const path = require("path");

  const ayGroups = readJsonFile(path.join(__dirname, "../../../data/academic-year-groups.json"));
  const ayVersions = readJsonFile(path.join(__dirname, "../../../data/academic-year-versions.json"));
  const cvVersions = readJsonFile(path.join(__dirname, "../../../data/curriculum-versions.json"));

  const groupById = Object.fromEntries(ayGroups.map((g) => [g.id, g]));
  const publishedYearByCurriculumId = {};
  for (const version of ayVersions) {
    if (version.status !== "published" || !version.curriculumId) continue;
    const group = groupById[version.yearGroupId];
    if (group) publishedYearByCurriculumId[version.curriculumId] = group.label;
  }

  const cvPublishedIds = new Set();
  const cvActiveIds = new Set();
  const ayPublishedIds = new Set();
  const coursesCountByCurriculumId = new Map();

  for (const version of cvVersions) {
    if (!version.curriculumId) continue;
    if (version.status === "published") cvPublishedIds.add(version.curriculumId);
    if (version.status === "active") cvActiveIds.add(version.curriculumId);
    if (version.isCurrent) {
      let count = 0;
      for (const period of (version.content || [])) {
        for (const cls of (period.classes || [])) {
          count += (cls.courses || []).length;
        }
      }
      coursesCountByCurriculumId.set(version.curriculumId, count);
    }
  }

  for (const version of ayVersions) {
    if (version.curriculumId && version.status === "published") {
      ayPublishedIds.add(version.curriculumId);
    }
  }

  return {
    getMeta(curriculum) {
      if (!curriculum?.id) {
        return {
          publishedAcademicYear: null,
          effectiveStatus: curriculum?.status || "draft",
          coursesCount: 0,
        };
      }

      let effectiveStatus;
      if (curriculum.isProgram) {
        // Programs run on their own fixed startDate/endDate (set on the Program record when
        // deployed to a hub), not an academic year cycle — so publishing only ever depends on
        // the curriculum version, never on an academic year being set up at all.
        effectiveStatus = cvPublishedIds.has(curriculum.id) ? "published" : (curriculum.status || "draft");
      } else if (cvPublishedIds.has(curriculum.id) && ayPublishedIds.has(curriculum.id)) {
        effectiveStatus = "published";
      } else if (cvActiveIds.has(curriculum.id)) {
        effectiveStatus = "active";
      } else {
        effectiveStatus = curriculum.status || "draft";
      }

      return {
        publishedAcademicYear: publishedYearByCurriculumId[curriculum.id] || null,
        effectiveStatus,
        coursesCount: coursesCountByCurriculumId.get(curriculum.id) || 0,
      };
    },
  };
}

function enrichCurriculum(curriculum, meta) {
  if (!curriculum) return curriculum;
  return { ...curriculum, ...meta.getMeta(curriculum) };
}

const CurriculumService = {
  async createCurriculum(data) {
    return CurriculumModel.create(data);
  },

  async getAllCurricula(filters) {
    const curricula = CurriculumModel.findAll(filters);
    const meta = buildCurriculumMeta();
    return curricula.map((c) => {
      return enrichCurriculum(c, meta);
    });
  },

  async getCurriculumById(id) {
    const curriculum = CurriculumModel.findById(id);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return enrichCurriculum(curriculum, buildCurriculumMeta());
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
    LearnerJourneyModel.deleteByCurriculumId(id);
    IndicatorAchievementModel.deleteByCurriculumId(id);
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
      getSessionAssessmentIds(s).forEach((aid) => assessmentIds.add(aid));
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

  // Every curriculum a course currently belongs to — via a direct link, or by appearing
  // anywhere in any of its versions' content (draft or published, mirroring how
  // autoPopulateFromCourse already treats "attached" at version create/publish time, not
  // just the current/published version).
  findCurriculaContainingCourse(courseId) {
    const curriculumIds = new Set();
    CourseCurriculumLinkModel.findByCourseId(courseId).forEach((l) => curriculumIds.add(l.curriculumId));
    CurriculumVersionModel.findAll().forEach((v) => {
      if (collectCourseIds(v.content).has(courseId)) curriculumIds.add(v.curriculumId);
    });
    return [...curriculumIds];
  },

  // Re-adopt this course's competencies/learning areas into every curriculum it currently
  // belongs to. Called whenever something upstream changes that could newly qualify a
  // competency/learning area for adoption (a competency tagged on one of its assessments, a
  // learning area tagged on the course, an assessment attached to one of its sessions) — safe
  // to call speculatively since autoPopulateFromCourse only ever adds, never removes.
  resyncCourseIntoCurricula(courseId) {
    this.findCurriculaContainingCourse(courseId).forEach((curriculumId) => this.autoPopulateFromCourse(curriculumId, courseId));
  },

  // Same, but starting from an assessment — resolves to every course that has a session
  // referencing it, then resyncs each of those courses' curricula.
  resyncCoursesForAssessment(assessmentId) {
    const courseIds = new Set(
      SessionModel.findAll()
        .filter((s) => sessionHasAssessment(s, assessmentId))
        .map((s) => s.courseId)
    );
    courseIds.forEach((courseId) => this.resyncCourseIntoCurricula(courseId));
  },
};

module.exports = CurriculumService;
