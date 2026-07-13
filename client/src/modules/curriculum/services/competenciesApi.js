import api from "../../../services/api";

const base = (curriculumId) => `/api/curricula/${curriculumId}/competencies`;

export const competenciesApi = {
  /* Curriculum ↔ Competency links — competencies are authored in Settings; a curriculum
   * just adopts entries from that shared catalog. */
  getCurriculumCompetencies: (curriculumId) =>
    api.get(`${base(curriculumId)}/links`).then((r) => r.data.data),

  linkCompetency: (curriculumId, competencyId) =>
    api.post(`${base(curriculumId)}/links`, { competencyId }).then((r) => r.data.data),

  unlinkCompetency: (curriculumId, competencyId) =>
    api.delete(`${base(curriculumId)}/links/${competencyId}`).then((r) => r.data.data),

  updateCompetencyLink: (curriculumId, competencyId, data) =>
    api.put(`${base(curriculumId)}/links/${competencyId}`, data).then((r) => r.data.data),

  /* Competency Indicators — how THIS curriculum evaluates an adopted competency */
  getCompetencyIndicators: (curriculumId, competencyId) =>
    api.get(`${base(curriculumId)}/links/${competencyId}/indicators`).then((r) => r.data.data),

  createCompetencyIndicator: (curriculumId, competencyId, data) =>
    api.post(`${base(curriculumId)}/links/${competencyId}/indicators`, data).then((r) => r.data.data),

  updateCompetencyIndicator: (curriculumId, competencyId, indicatorId, data) =>
    api.put(`${base(curriculumId)}/links/${competencyId}/indicators/${indicatorId}`, data).then((r) => r.data.data),

  deleteCompetencyIndicator: (curriculumId, competencyId, indicatorId) =>
    api.delete(`${base(curriculumId)}/links/${competencyId}/indicators/${indicatorId}`).then((r) => r.data),

  /* Learning Areas — grouping for competencies as used within this curriculum */
  getLearningAreas: (curriculumId) =>
    api.get(`${base(curriculumId)}/learning-areas`).then((r) => r.data.data),

  createLearningArea: (curriculumId, data) =>
    api.post(`${base(curriculumId)}/learning-areas`, data).then((r) => r.data.data),

  updateLearningArea: (curriculumId, aId, data) =>
    api.put(`${base(curriculumId)}/learning-areas/${aId}`, data).then((r) => r.data.data),

  deleteLearningArea: (curriculumId, aId) =>
    api.delete(`${base(curriculumId)}/learning-areas/${aId}`).then((r) => r.data),

  importLearningArea: (curriculumId, learningAreaId) =>
    api.post(`${base(curriculumId)}/learning-areas/import`, { learningAreaId }).then((r) => r.data.data),

  /* Progression Ladder */
  getLadder: (curriculumId) =>
    api.get(`${base(curriculumId)}/ladder`).then((r) => r.data.data),

  updateLadder: (curriculumId, rungs) =>
    api.put(`${base(curriculumId)}/ladder`, { rungs }).then((r) => r.data.data),

  /* Age Categories */
  getAgeCategories: (curriculumId) =>
    api.get(`${base(curriculumId)}/age-categories`).then((r) => r.data.data),

  createAgeCategory: (curriculumId, data) =>
    api.post(`${base(curriculumId)}/age-categories`, data).then((r) => r.data.data),

  updateAgeCategory: (curriculumId, acId, data) =>
    api.put(`${base(curriculumId)}/age-categories/${acId}`, data).then((r) => r.data.data),

  deleteAgeCategory: (curriculumId, acId) =>
    api.delete(`${base(curriculumId)}/age-categories/${acId}`).then((r) => r.data),

  /* Progress Levels */
  getProgressLevels: (curriculumId) =>
    api.get(`${base(curriculumId)}/levels`).then((r) => r.data.data),

  createProgressLevel: (curriculumId, data) =>
    api.post(`${base(curriculumId)}/levels`, data).then((r) => r.data.data),

  updateProgressLevel: (curriculumId, plId, data) =>
    api.put(`${base(curriculumId)}/levels/${plId}`, data).then((r) => r.data.data),

  deleteProgressLevel: (curriculumId, plId) =>
    api.delete(`${base(curriculumId)}/levels/${plId}`).then((r) => r.data),

  /* Assessments */
  getAssessments: (curriculumId) =>
    api.get(`${base(curriculumId)}/assessments`).then((r) => r.data.data),

  createAssessment: (curriculumId, data) =>
    api.post(`${base(curriculumId)}/assessments`, data).then((r) => r.data.data),

  updateAssessment: (curriculumId, asId, data) =>
    api.put(`${base(curriculumId)}/assessments/${asId}`, data).then((r) => r.data.data),

  deleteAssessment: (curriculumId, asId) =>
    api.delete(`${base(curriculumId)}/assessments/${asId}`).then((r) => r.data),

  /* Assessment Framework — Assessment Types */
  getAssessmentTypes: (curriculumId) =>
    api.get(`/api/curricula/${curriculumId}/assessments/types`).then((r) => r.data.data),

  createAssessmentType: (curriculumId, data) =>
    api.post(`/api/curricula/${curriculumId}/assessments/types`, data).then((r) => r.data.data),

  updateAssessmentType: (curriculumId, atId, data) =>
    api.put(`/api/curricula/${curriculumId}/assessments/types/${atId}`, data).then((r) => r.data.data),

  deleteAssessmentType: (curriculumId, atId) =>
    api.delete(`/api/curricula/${curriculumId}/assessments/types/${atId}`).then((r) => r.data),

  updateScoring: (curriculumId, atId, evidenceWeights) =>
    api.put(`/api/curricula/${curriculumId}/assessments/types/${atId}/scoring`, { evidenceWeights }).then((r) => r.data.data),

  getCompetencyWeights: (curriculumId) =>
    api.get(`/api/curricula/${curriculumId}/assessments/scoring`).then((r) => r.data.data),

  updateGlobalScoring: (curriculumId, assessmentTypes, competencyWeights = []) =>
    api.put(`/api/curricula/${curriculumId}/assessments/scoring`, { assessmentTypes, competencyWeights }).then((r) => r.data.data),

  calculateScore: (curriculumId, atId, evidenceScores) =>
    api.post(`/api/curricula/${curriculumId}/assessments/types/${atId}/calculate`, { evidenceScores }).then((r) => r.data.data),

  /* Assessment Framework — Evidence Types */
  getEvidenceTypes: (curriculumId) =>
    api.get(`/api/curricula/${curriculumId}/assessments/evidence`).then((r) => r.data.data),

  createEvidenceType: (curriculumId, data) =>
    api.post(`/api/curricula/${curriculumId}/assessments/evidence`, data).then((r) => r.data.data),

  updateEvidenceType: (curriculumId, etId, data) =>
    api.put(`/api/curricula/${curriculumId}/assessments/evidence/${etId}`, data).then((r) => r.data.data),

  deleteEvidenceType: (curriculumId, etId) =>
    api.delete(`/api/curricula/${curriculumId}/assessments/evidence/${etId}`).then((r) => r.data),

  /* Performance Bands */
  getPerformanceBands: (curriculumId) =>
    api.get(`/api/curricula/${curriculumId}/competencies/bands`).then((r) => r.data.data),

  createPerformanceBand: (curriculumId, data) =>
    api.post(`/api/curricula/${curriculumId}/competencies/bands`, data).then((r) => r.data.data),

  updatePerformanceBand: (curriculumId, bandId, data) =>
    api.put(`/api/curricula/${curriculumId}/competencies/bands/${bandId}`, data).then((r) => r.data.data),

  deletePerformanceBand: (curriculumId, bandId) =>
    api.delete(`/api/curricula/${curriculumId}/competencies/bands/${bandId}`).then((r) => r.data),

  reorderPerformanceBands: (curriculumId, orderedIds) =>
    api.put(`/api/curricula/${curriculumId}/competencies/bands/reorder`, { orderedIds }).then((r) => r.data.data),

  normalizeBandIndicators: (curriculumId, bandId) =>
    api.post(`/api/curricula/${curriculumId}/competencies/bands/${bandId}/normalize`).then((r) => r.data.data),
};
