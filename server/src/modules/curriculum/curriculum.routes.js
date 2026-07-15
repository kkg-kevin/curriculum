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
} = require("./competency-framework/competency.controller");

const router = express.Router();

// Curriculum CRUD
router.route("/").get(getAllCurricula).post(createCurriculum);
router.route("/:id").get(getCurriculumById).put(updateCurriculum).delete(deleteCurriculum);

// Courses — added to this curriculum from here (a course stays independent otherwise)
router.route("/:id/courses/links").get(getCurriculumCourses).post(linkCourse);
router.route("/:id/courses/links/:courseId").delete(unlinkCourse);

// Curriculum version control
router.route("/:id/versions").get(getVersions).post(createVersion);
// The courses actually live for this curriculum right now (from the published version's
// content, optionally scoped to one grade) — what learner/teacher portals should read.
router.route("/:id/versions/current/courses").get(getCurrentCourses);
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
router.route("/:id/competencies/learning-areas").get(getLearningAreas).post(createLearningArea);
router.route("/:id/competencies/learning-areas/import").post(importLearningArea);
router.route("/:id/competencies/learning-areas/:aId").put(updateLearningArea).delete(deleteLearningArea);

// Competencies — progression ladder
router.route("/:id/competencies/ladder").get(getLadder).put(updateLadder);

// Competencies — indicators actually tagged in this curriculum's attached assessments,
// grouped by competency (computed live) — feeds the Performance Bands indicator picker.
router.route("/:id/competencies/populated-indicators").get(getPopulatedIndicators);

// Progress Arc — age categories
router.route("/:id/competencies/age-categories").get(getAgeCategories).post(createAgeCategory);
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

module.exports = router;
