const CurriculumModel          = require("./curriculum.model");
const UserModel = require("../auth/user.model");
const ClassModel = require("../classes/class.model");
const ClassService = require("../classes/class.service");
const ProgramModel = require("../programs/program.model");
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
const AcademicYearGroupModel = require("./academic-years/academic-year-groups.model");
const AcademicYearVersionModel = require("./academic-years/academic-year-versions.model");
const LearnerJourneyModel = require("./competency-framework/learner-journey.model");
const IndicatorAchievementModel = require("./competency-framework/indicator-achievement.model");
const { collectCourseIds } = require("./versions/content.utils");
const { getSessionAssessmentIds, sessionHasAssessment } = require("../courses/sessionAssessment.utils");

// Builds the same publish-status/course-count lookups the JSON-file era computed by reading
// academic-year-groups.json/academic-year-versions.json/curriculum-versions.json directly —
// now sourced from the real tables, scoped to just the curricula being enriched (getMeta is
// only ever called against one of `curricula`).
async function buildCurriculumMeta(curricula) {
  const ayGroups = [];
  const ayVersions = [];
  const cvVersions = [];
  for (const c of curricula) {
    ayGroups.push(...(await AcademicYearGroupModel.findByCurriculumId(c.id)));
    ayVersions.push(...(await AcademicYearVersionModel.findByCurriculumId(c.id)));
    cvVersions.push(...(await CurriculumVersionModel.findAllByCurriculumId(c.id)));
  }

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

async function enrichCurriculum(curriculum, meta) {
  if (!curriculum) return curriculum;
  const enriched = { ...curriculum, ...meta.getMeta(curriculum) };
  // Resolved fresh from the live user record each read, never stored, so it can't drift if
  // that account's name/email changes later (same posture as program.service.js's enrich()).
  if (curriculum.curriculumAdminId) {
    const admin = await UserModel.findById(curriculum.curriculumAdminId);
    enriched.curriculumAdmin = admin ? { id: admin.id, name: admin.name, email: admin.email } : null;
  } else {
    enriched.curriculumAdmin = null;
  }
  return enriched;
}

const CurriculumService = {
  async createCurriculum(data) {
    return CurriculumModel.create(data);
  },

  async getAllCurricula(filters) {
    const curricula = await CurriculumModel.findAll(filters);
    const meta = await buildCurriculumMeta(curricula);
    return Promise.all(curricula.map((c) => enrichCurriculum(c, meta)));
  },

  async getCurriculumById(id) {
    const curriculum = await CurriculumModel.findById(id);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return enrichCurriculum(curriculum, await buildCurriculumMeta([curriculum]));
  },

  async updateCurriculum(id, data) {
    const existing = await CurriculumModel.findById(id);
    const curriculum = await CurriculumModel.update(id, data);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    if (existing && Array.isArray(data.classes)) {
      await this.syncClassGradeNames(id, existing.classes || [], data.classes);
    }
    return curriculum;
  },

  // A cohort's `name` here is copied onto Class.gradeName once, at the moment a Class is
  // created from it (Program deployment / Set Up Year) — never re-read after that. Renaming a
  // cohort on the curriculum would otherwise leave every already-created Class showing the old
  // name forever, with nothing to signal the drift. Push the rename onto them here instead.
  async syncClassGradeNames(curriculumId, oldClasses, newClasses) {
    const oldNameById = new Map(oldClasses.map((c) => [c.id, c.name]));
    const allClasses = await ClassModel.findAll();
    for (const cls of newClasses) {
      const oldName = oldNameById.get(cls.id);
      if (oldName === undefined || oldName === cls.name) continue;
      const matching = allClasses.filter((c) => c.curriculumId === curriculumId && c.gradeId === cls.id);
      await Promise.all(matching.map((c) => ClassModel.update(c.id, { gradeName: cls.name })));
    }
  },

  // Bypasses updateCurriculumSchema entirely — curriculumAdminId is deliberately never part of
  // the general update payload (see curriculum.validation.js), only ever set here by the
  // dedicated assign/unassign controller actions.
  async setCurriculumAdmin(id, curriculumAdminId) {
    const curriculum = await CurriculumModel.update(id, { curriculumAdminId });
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return enrichCurriculum(curriculum, await buildCurriculumMeta([curriculum]));
  },

  async deleteCurriculum(id) {
    const deleted = await CurriculumModel.delete(id);
    if (!deleted) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    await CourseCurriculumLinkModel.deleteByCurriculumId(id);
    // Every other piece of the competency framework is scoped to this curriculum and has
    // no life outside it — without this, deleting a curriculum leaves orphaned records
    // behind in every one of these files forever (found via audit — the earlier version of
    // this method only ever cleaned up the course link).
    await CurriculumCompetencyLinkModel.deleteByCurriculumId(id);
    await CurriculumCompetencyIndicatorModel.deleteByCurriculumId(id);
    await LearningAreaModel.deleteByCurriculumId(id);
    await AgeCategoryModel.deleteByCurriculumId(id);
    await ProgressLevelModel.deleteByCurriculumId(id);
    await AssessmentTypeModel.deleteByCurriculumId(id);
    await EvidenceTypeModel.deleteByCurriculumId(id);
    await PerformanceBandModel.deleteByCurriculumId(id);
    await ProgressionLadderModel.deleteByCurriculumId(id);
    await CurriculumAssessmentModel.deleteByCurriculumId(id);
    await CurriculumVersionModel.deleteByCurriculumId(id);
    await LearnerJourneyModel.deleteByCurriculumId(id);
    await IndicatorAchievementModel.deleteByCurriculumId(id);
    // A Program deployed from this curriculum (see program.service.js's createProgram) has no
    // life outside it either — unlike ProgramModel.delete's own deliberate choice to leave a
    // program's Classes standing when just the Program record is removed (that's a real cohort's
    // history surviving an admin un-deploying it), everything the deployed Classes depended on to
    // function — this curriculum's course list, competency framework, versions — is being wiped
    // right here, so leaving them behind would just orphan them with nothing left to resolve.
    const programs = await ProgramModel.findAll({ curriculumId: id });
    for (const program of programs) {
      // A classId can already be gone (e.g. deleted individually from the Classes page earlier) —
      // skip those rather than let ClassService.deleteClass's 404 abort the curriculum delete.
      for (const classId of program.classIds || []) {
        if (await ClassModel.findById(classId)) await ClassService.deleteClass(classId);
      }
      await ProgramModel.delete(program.id);
    }
    return { message: "Curriculum deleted successfully" };
  },

  /* ── Courses (added to this curriculum from here — a course stays independent
   * and reusable otherwise, this just records where it's currently used) ── */

  async getCurriculumCourses(curriculumId) {
    const links = await CourseCurriculumLinkModel.findByCurriculumId(curriculumId);
    const courses = await Promise.all(links.map((l) => CourseModel.findById(l.courseId)));
    return courses.filter(Boolean);
  },

  async linkCourse(curriculumId, courseId) {
    const curriculum = await CurriculumModel.findById(curriculumId);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    const course = await CourseModel.findById(courseId);
    if (!course) {
      const err = new Error("Course not found");
      err.statusCode = 404;
      throw err;
    }
    await CourseCurriculumLinkModel.link(courseId, curriculumId);
    await this.autoPopulateFromCourse(curriculumId, courseId);
    return this.getCurriculumCourses(curriculumId);
  },

  // A course carries competencies (via the assessments attached to its sessions) and
  // learning areas (tagged directly on it). When it's attached to a curriculum, adopt both
  // into the curriculum — a one-time copy taken at attach time, not a live sync: if the
  // course's assessments gain new competency tags afterward, curricula it's already
  // attached to won't pick those up automatically.
  async autoPopulateFromCourse(curriculumId, courseId) {
    // Competencies — via every assessment attached to any of this course's sessions.
    const assessmentIds = new Set();
    const sessions = await SessionModel.findByCourseId(courseId);
    sessions.forEach((s) => {
      getSessionAssessmentIds(s).forEach((aid) => assessmentIds.add(aid));
    });
    const competencyIds = new Set();
    for (const aid of assessmentIds) {
      const links = await AssessmentCompetencyLinkModel.findByAssessmentId(aid);
      links.forEach((l) => competencyIds.add(l.competencyId));
    }
    await Promise.all([...competencyIds].map((competencyId) => CurriculumCompetencyLinkModel.link(curriculumId, competencyId)));

    // Learning areas — tagged directly on the course. Cloned into this curriculum's own
    // list on first use (same pattern as CompetencyService.importLearningArea, matched by
    // name to avoid duplicates) — but seeded with just this course, not the global catalog
    // entry's own `courses` list (that's a separate, manually-curated field unrelated to why
    // this area is being adopted here). If the curriculum already has this learning area
    // from an earlier course, this course is appended to it instead of being dropped.
    const curriculumAreas = await LearningAreaModel.findByCurriculumId(curriculumId);
    const areaByName = new Map(curriculumAreas.map((a) => [a.name.toLowerCase(), a]));
    const courseAreaLinks = await CourseLearningAreaLinkModel.findByCourseId(courseId);
    for (const link of courseAreaLinks) {
      const source = await LearningAreaCatalogModel.findById(link.learningAreaId);
      if (!source) continue;
      const existing = areaByName.get(source.name.toLowerCase());
      if (existing) {
        if (!(existing.courses || []).includes(courseId)) {
          const updated = await LearningAreaModel.update(existing.id, { courses: [...(existing.courses || []), courseId] });
          areaByName.set(source.name.toLowerCase(), updated);
        }
      } else {
        const created = await LearningAreaModel.create({
          curriculumId,
          name:        source.name,
          description: source.description,
          color:       source.color,
          courses:     [courseId],
        });
        areaByName.set(source.name.toLowerCase(), created);
      }
    }
  },

  async unlinkCourse(curriculumId, courseId) {
    await CourseCurriculumLinkModel.unlink(courseId, curriculumId);
    return this.getCurriculumCourses(curriculumId);
  },

  // Every curriculum a course currently belongs to — via a direct link, or by appearing
  // anywhere in any of its versions' content (draft or published, mirroring how
  // autoPopulateFromCourse already treats "attached" at version create/publish time, not
  // just the current/published version).
  async findCurriculaContainingCourse(courseId) {
    const curriculumIds = new Set();
    const links = await CourseCurriculumLinkModel.findByCourseId(courseId);
    links.forEach((l) => curriculumIds.add(l.curriculumId));
    const versions = await CurriculumVersionModel.findAll();
    versions.forEach((v) => {
      if (collectCourseIds(v.content).has(courseId)) curriculumIds.add(v.curriculumId);
    });
    return [...curriculumIds];
  },

  // Re-adopt this course's competencies/learning areas into every curriculum it currently
  // belongs to. Called whenever something upstream changes that could newly qualify a
  // competency/learning area for adoption (a competency tagged on one of its assessments, a
  // learning area tagged on the course, an assessment attached to one of its sessions) — safe
  // to call speculatively since autoPopulateFromCourse only ever adds, never removes.
  async resyncCourseIntoCurricula(courseId) {
    const curriculumIds = await this.findCurriculaContainingCourse(courseId);
    await Promise.all(curriculumIds.map((curriculumId) => this.autoPopulateFromCourse(curriculumId, courseId)));
  },

  // Same, but starting from an assessment — resolves to every course that has a session
  // referencing it, then resyncs each of those courses' curricula.
  async resyncCoursesForAssessment(assessmentId) {
    const sessions = await SessionModel.findAll();
    const courseIds = new Set(
      sessions.filter((s) => sessionHasAssessment(s, assessmentId)).map((s) => s.courseId)
    );
    await Promise.all([...courseIds].map((courseId) => this.resyncCourseIntoCurricula(courseId)));
  },
};

module.exports = CurriculumService;
