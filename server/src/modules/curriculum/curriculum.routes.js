const express = require("express");
const {
  createCurriculum,
  getAllCurricula,
  getMyCurriculum,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
  getCurriculumCourses,
  linkCourse,
  unlinkCourse,
  assignCurriculumAdmin,
  unassignCurriculumAdmin,
} = require("./curriculum.controller");
const {
  getVersions,
  createVersion,
  editVersion,
  changeVersionStatus,
  getCurrentCourses,
} = require("./versions/curriculum-versions.controller");
const {
  getAcademicYears,
  createGroup,
  createVersion: createAYVersion,
  changeStatus,
} = require("./academic-years/academic-years.controller");
const {
  getCurriculumCompetencies,
  linkCompetency,
  unlinkCompetency,
  updateCompetencyLink,
  getCompetencyIndicators,
  createCompetencyIndicator,
  updateCompetencyIndicator,
  deleteCompetencyIndicator,
  getLearningAreas,
  createLearningArea,
  updateLearningArea,
  deleteLearningArea,
  importLearningArea,
  getLadder,
  updateLadder,
  getAgeCategories,
  createAgeCategory,
  updateAgeCategory,
  deleteAgeCategory,
  getProgressLevels,
  createProgressLevel,
  updateProgressLevel,
  deleteProgressLevel,
  getAssessmentTypes,
  createAssessmentType,
  updateAssessmentType,
  deleteAssessmentType,
  updateScoring,
  updateGlobalScoring,
  getCompetencyWeights,
  calculateScore,
  getEvidenceTypes,
  createEvidenceType,
  updateEvidenceType,
  deleteEvidenceType,
  getPerformanceBands,
  createPerformanceBand,
  updatePerformanceBand,
  deletePerformanceBand,
  reorderPerformanceBands,
  duplicatePerformanceBandToNext,
  calculateIndicatorProgress,
  getPopulatedIndicators,
  getIndicatorAchievements,
  setIndicatorAchievement,
  getCompetencyScores,
  getBandProgress,
  getLearnerCompetencyScores,
  getLearnerBandProgress,
  getLearningJourney,
  placeLearner,
} = require("./competency-framework/competency.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

// A school only ever reads/writes within its own assigned curriculum, and a curriculumAdmin
// only ever reads/writes the one curriculum they're assigned to manage — never another
// curriculum, even by guessing an id. No-op for every other role (their own authorize(...) call
// already decided whether they belong on the route at all — admin is always unrestricted here).
function ownCurriculumOnly(req, res, next) {
  if (req.user.role === "school") {
    const accessible = req.ownSchoolCurriculumIds || (req.ownSchool?.curriculumId ? [req.ownSchool.curriculumId] : []);
    assertOwn(accessible.includes(req.params.id));
  }
  if (req.user.role === "curriculumAdmin") assertOwn(req.ownCurriculum?.id === req.params.id);
  next();
}

const router = express.Router();

// The reads (and, for Learning Journey, one write) school/teacher/learner portals need from
// this whole module. A school inherits its classes and courses from whatever curriculum it's
// assigned, so it needs to read that curriculum's name/structure/periods and the courses live
// right now for it; teacher/learner need the latter too, scoped to one grade. A school also
// manages where its own learners sit on the curriculum's Learning Journey (see LearnerViewPage)
// — that needs the ladder, learning areas, age categories, and the per-learner journey itself,
// read AND (for placement) write. All ownership-checked (ownSchool's curriculumId must match).
// A learner also needs its own curriculum's competency names and age-categories for the
// learner-portal profile (read-only, no ownership check — same posture as the courses read
// above; competency/age-category names aren't treated as school-sensitive data anywhere else
// in this module). Registered before the router-wide gate below so they're the sole exceptions
// for school/teacher/learner; a "curriculumAdmin" instead gets the same authoring access as
// admin (scoped to their own curriculum) via that gate further down.
// "/mine" must come before "/:id" below — otherwise Express would match "mine" as the :id
// param and this route would never be reached.
router.route("/mine").get(authorize("curriculumAdmin"), getMyCurriculum);
router.route("/:id").get(authorize("admin", "school", "teacher", "curriculumAdmin"), getCurriculumById);
router.route("/:id/versions/current/courses").get(authorize("admin", "school", "teacher", "learner"), getCurrentCourses);
router.route("/:id/competencies/links").get(authorize("admin", "learner"), getCurriculumCompetencies);
router.route("/:id/competencies/ladder").get(authorize("admin", "school"), ownCurriculumOnly, getLadder);
router.route("/:id/competencies/learning-areas").get(authorize("admin", "school", "learner"), ownCurriculumOnly, getLearningAreas);
router.route("/:id/competencies/age-categories").get(authorize("admin", "school", "learner"), ownCurriculumOnly, getAgeCategories);
// Progress Levels — plain name/description/score-range lookup, same non-sensitive posture as
// age-categories above. Needed by the learner Dashboard to map an averaged competency score onto
// a level name (see DevelopmentalSnapshotCard's "Current Level Summary").
router.route("/:id/competencies/levels").get(authorize("admin", "school", "learner"), ownCurriculumOnly, getProgressLevels);
// Real per-learner competency score/band-progress — a learner reading their own profile, or
// admin/school reviewing a learner in their own hub (ownership enforced in the controller,
// same shape as assessment-submission's getLearnerIndicatorProgress). Registered here, ahead of
// the blanket admin/curriculumAdmin gate below, same as the other learner-reachable reads above.
router.route("/:id/competencies/scores/learner/:learnerId").get(authorize("admin", "school", "learner"), ownCurriculumOnly, getLearnerCompetencyScores);
router.route("/:id/competencies/bands/progress/learner/:learnerId").get(authorize("admin", "school", "learner"), ownCurriculumOnly, getLearnerBandProgress);
router.route("/:id/competencies/learning-journey/:learnerId").get(authorize("admin", "school", "learner"), ownCurriculumOnly, getLearningJourney);
router.route("/:id/competencies/learning-journey/:learnerId/:areaId").post(authorize("admin", "school"), ownCurriculumOnly, placeLearner);
// Curriculum CRUD — listing every curriculum, creating a new one, and deleting one outright
// stay global-admin-only actions; a curriculumAdmin only ever manages content *within* their
// one assigned curriculum, never the roster of curricula or the record's own lifecycle.
router.route("/").get(authorize("admin"), getAllCurricula).post(authorize("admin"), createCurriculum);
router.route("/:id")
  .put(authorize("admin", "curriculumAdmin"), ownCurriculumOnly, updateCurriculum)
  .delete(authorize("admin"), deleteCurriculum);

// Who manages this curriculum — assigning/removing a curriculumAdmin is itself a global-admin
// action (a curriculumAdmin can't grant themselves or anyone else more access). Only one at a
// time (curriculum.curriculumAdminId) — assigning again replaces whoever was there before.
router.route("/:id/admin")
  .post(authorize("admin"), assignCurriculumAdmin)
  .delete(authorize("admin"), unassignCurriculumAdmin);

// Everything below is curriculum-authoring content (courses, versions, academic years,
// competencies, assessments, performance bands, learning journey) — admin is unrestricted;
// curriculumAdmin may only touch the one curriculum they're assigned to (ownCurriculumOnly).
// Mounted on "/:id" (not a path-less use()) so Express resolves req.params.id on this layer
// itself before ownCurriculumOnly runs — a path-less use() sees req.params.id as undefined
// here since params are only bound by the layer whose own pattern matched them, which for a
// bare use() is never this one.
router.use("/:id", authorize("admin", "curriculumAdmin"), ownCurriculumOnly);

// Courses — added to this curriculum from here (a course stays independent otherwise)
router.route("/:id/courses/links").get(getCurriculumCourses).post(linkCourse);
router.route("/:id/courses/links/:courseId").delete(unlinkCourse);

// Curriculum version control
router.route("/:id/versions").get(getVersions).post(createVersion);
router.route("/:id/versions/:vId").put(editVersion);
router.route("/:id/versions/:vId/status").patch(changeVersionStatus);

// Academic years — two-level hierarchy (groups → versions)
router.route("/:id/academic-years").get(getAcademicYears).post(createGroup);
router.route("/:id/academic-years/:groupId/versions").post(createAYVersion);
router.route("/:id/academic-years/:groupId/versions/:versionId/status").patch(changeStatus);

// Competencies — this curriculum's adopted competencies (authored globally under /api/competencies)
// GET is registered above (learner-portal profile needs the names) — only the write stays admin-only here.
router.route("/:id/competencies/links").post(linkCompetency);
router.route("/:id/competencies/links/:competencyId").put(updateCompetencyLink).delete(unlinkCompetency);

// Competencies — indicators for how THIS curriculum evaluates an adopted competency
router.route("/:id/competencies/links/:competencyId/indicators").get(getCompetencyIndicators).post(createCompetencyIndicator);
router.route("/:id/competencies/links/:competencyId/indicators/:indicatorId").put(updateCompetencyIndicator).delete(deleteCompetencyIndicator);

// Competencies — learning areas (curriculum-scoped groupings for adopted competencies)
// GET is registered above (school needs it too) — only the writes stay admin-only here.
router.route("/:id/competencies/learning-areas").post(createLearningArea);
router.route("/:id/competencies/learning-areas/import").post(importLearningArea);
router.route("/:id/competencies/learning-areas/:aId").put(updateLearningArea).delete(deleteLearningArea);

// Competencies — progression ladder (GET registered above — school needs it too)
router.route("/:id/competencies/ladder").put(updateLadder);

// Competencies — indicators actually tagged in this curriculum's attached assessments,
// grouped by competency (computed live) — feeds the Performance Bands indicator picker.
router.route("/:id/competencies/populated-indicators").get(getPopulatedIndicators);

// Competencies — persisted marks-earned per indicator (Engine 5 framework), joined against
// the live marksPossible above. Feeds the computed competency scores below and, converted to
// percentages, the indicator-driven band completion further down.
router.route("/:id/competencies/indicator-achievements").get(getIndicatorAchievements);
router.route("/:id/competencies/indicator-achievements/:indicatorId").put(setIndicatorAchievement);

// Competencies — computed score per adopted competency (Engine 5 → Engine 3), for display
// alongside each competency in the Competencies tab.
router.route("/:id/competencies/scores").get(getCompetencyScores);

// Progress Arc — age categories (GET registered above — school needs it too)
router.route("/:id/competencies/age-categories").post(createAgeCategory);
router.route("/:id/competencies/age-categories/:acId").put(updateAgeCategory).delete(deleteAgeCategory);

// Progress Arc — progress levels (GET registered above — learner Dashboard needs it too)
router.route("/:id/competencies/levels").post(createProgressLevel);
router.route("/:id/competencies/levels/:plId").put(updateProgressLevel).delete(deleteProgressLevel);

// Assessment Framework — assessment types
router.route("/:id/assessments/types").get(getAssessmentTypes).post(createAssessmentType);
router.route("/:id/assessments/types/:atId").put(updateAssessmentType).delete(deleteAssessmentType);
router.route("/:id/assessments/types/:atId/scoring").put(updateScoring);
router.route("/:id/assessments/types/:atId/calculate").post(calculateScore);

// Assessment Framework — global scoring (two-tier + competency contributions)
router.route("/:id/assessments/scoring").get(getCompetencyWeights).put(updateGlobalScoring);

// Assessment Framework — evidence types
router.route("/:id/assessments/evidence").get(getEvidenceTypes).post(createEvidenceType);
router.route("/:id/assessments/evidence/:etId").put(updateEvidenceType).delete(deleteEvidenceType);

// Performance Bands
router.route("/:id/competencies/bands").get(getPerformanceBands).post(createPerformanceBand);
router.route("/:id/competencies/bands/reorder").put(reorderPerformanceBands);
// Progress Arc — indicator-driven band completion (must come before the /:bandId wildcard below)
router.route("/:id/competencies/bands/progress/calculate").post(calculateIndicatorProgress);
// Progress Arc — same engine, but driven by persisted indicator-achievements instead of a
// caller-supplied payload (see indicator-achievements routes above).
router.route("/:id/competencies/bands/progress").get(getBandProgress);
// Copy a configured band's setup onto the next band in the same stage's ladder — the two-segment
// path keeps it clear of the bare /:bandId PUT/DELETE below.
router.route("/:id/competencies/bands/:bandId/duplicate-to-next").post(duplicatePerformanceBandToNext);
router.route("/:id/competencies/bands/:bandId").put(updatePerformanceBand).delete(deletePerformanceBand);

// Learning Journey — per-learner, per-Learning-Area placement/history (both registered above —
// school needs to read and place its own learners too).

module.exports = router;
