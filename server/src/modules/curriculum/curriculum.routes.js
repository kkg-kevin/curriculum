const express = require("express");
const {
  createCurriculum,
  getAllCurricula,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
  getCurriculumCourses,
  linkCourse,
  unlinkCourse,
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
  getAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
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
  calculateIndicatorProgress,
  getPopulatedIndicators,
  getLearningJourney,
  placeLearner,
} = require("./competency-framework/competency.controller");
const { authorize } = require("../../shared/middleware/auth.middleware");
const { assertOwn } = require("../../shared/middleware/scope.middleware");

// A school only ever reads/writes within its own assigned curriculum — never another
// school's, even by guessing an id. No-op for every other role (their own authorize(...) call
// already decided whether they belong on the route at all).
function ownCurriculumOnly(req, res, next) {
  if (req.user.role === "school") assertOwn(req.ownSchool?.curriculumId === req.params.id);
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
// Registered before the router-wide admin gate below so they're the sole exceptions; everything
// else in this module (CRUD, structure, versions, competency/assessment authoring) stays
// admin-only.
router.route("/:id").get(authorize("admin", "school", "teacher"), getCurriculumById);
router.route("/:id/versions/current/courses").get(authorize("admin", "school", "teacher", "learner"), getCurrentCourses);
router.route("/:id/competencies/ladder").get(authorize("admin", "school"), ownCurriculumOnly, getLadder);
router.route("/:id/competencies/learning-areas").get(authorize("admin", "school"), ownCurriculumOnly, getLearningAreas);
router.route("/:id/competencies/age-categories").get(authorize("admin", "school"), ownCurriculumOnly, getAgeCategories);
router.route("/:id/competencies/learning-journey/:learnerId").get(authorize("admin", "school"), ownCurriculumOnly, getLearningJourney);
router.route("/:id/competencies/learning-journey/:learnerId/:areaId").post(authorize("admin", "school"), ownCurriculumOnly, placeLearner);
router.use(authorize("admin"));

// Curriculum CRUD
router.route("/").get(getAllCurricula).post(createCurriculum);
router.route("/:id").put(updateCurriculum).delete(deleteCurriculum);

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
router.route("/:id/competencies/links").get(getCurriculumCompetencies).post(linkCompetency);
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

// Progress Arc — age categories (GET registered above — school needs it too)
router.route("/:id/competencies/age-categories").post(createAgeCategory);
router.route("/:id/competencies/age-categories/:acId").put(updateAgeCategory).delete(deleteAgeCategory);

// Progress Arc — progress levels
router.route("/:id/competencies/levels").get(getProgressLevels).post(createProgressLevel);
router.route("/:id/competencies/levels/:plId").put(updateProgressLevel).delete(deleteProgressLevel);

// Assessments (legacy simple list)
router.route("/:id/competencies/assessments").get(getAssessments).post(createAssessment);
router.route("/:id/competencies/assessments/:asId").put(updateAssessment).delete(deleteAssessment);

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
router.route("/:id/competencies/bands/:bandId").put(updatePerformanceBand).delete(deletePerformanceBand);

// Learning Journey — per-learner, per-Learning-Area placement/history (both registered above —
// school needs to read and place its own learners too).

module.exports = router;
