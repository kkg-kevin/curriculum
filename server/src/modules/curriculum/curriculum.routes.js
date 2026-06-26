const express = require("express");
const {
  createCurriculum,
  getAllCurricula,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
} = require("./curriculum.controller");
const {
  getVersions,
  createVersion,
  editVersion,
  changeVersionStatus,
} = require("./curriculum-versions.controller");
const {
  getAcademicYears,
  createGroup,
  createVersion: createAYVersion,
  changeStatus,
} = require("./academic-years.controller");
const {
  getLearningAreas,
  createLearningArea,
  updateLearningArea,
  deleteLearningArea,
  getCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
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
} = require("./competency.controller");

const router = express.Router();

// Curriculum CRUD
router.route("/").get(getAllCurricula).post(createCurriculum);
router.route("/:id").get(getCurriculumById).put(updateCurriculum).delete(deleteCurriculum);

// Curriculum version control
router.route("/:id/versions").get(getVersions).post(createVersion);
router.route("/:id/versions/:vId").put(editVersion);
router.route("/:id/versions/:vId/status").patch(changeVersionStatus);

// Academic years — two-level hierarchy (groups → versions)
router.route("/:id/academic-years").get(getAcademicYears).post(createGroup);
router.route("/:id/academic-years/:groupId/versions").post(createAYVersion);
router.route("/:id/academic-years/:groupId/versions/:versionId/status").patch(changeStatus);

// Competencies — learning areas
router.route("/:id/competencies/learning-areas").get(getLearningAreas).post(createLearningArea);
router.route("/:id/competencies/learning-areas/:aId").put(updateLearningArea).delete(deleteLearningArea);

// Competencies — competency items
router.route("/:id/competencies/items").get(getCompetencies).post(createCompetency);
router.route("/:id/competencies/items/:cId").put(updateCompetency).delete(deleteCompetency);

// Competencies — progression ladder
router.route("/:id/competencies/ladder").get(getLadder).put(updateLadder);

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
router.route("/:id/competencies/bands/:bandId").put(updatePerformanceBand).delete(deletePerformanceBand);

module.exports = router;
