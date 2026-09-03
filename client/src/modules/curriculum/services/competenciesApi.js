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

  /* Pathways — this curriculum's own roadmaps (courses + diagnostic + age + placement) */
  getPathways: (curriculumId) =>
    api.get(`${base(curriculumId)}/pathways`).then((r) => r.data.data),

  createPathway: (curriculumId, data) =>
    api.post(`${base(curriculumId)}/pathways`, data).then((r) => r.data.data),

  updatePathway: (curriculumId, pathwayId, data) =>
    api.put(`${base(curriculumId)}/pathways/${pathwayId}`, data).then((r) => r.data.data),

  deletePathway: (curriculumId, pathwayId) =>
    api.delete(`${base(curriculumId)}/pathways/${pathwayId}`).then((r) => r.data),

  // pathwayId here is a pathway-template id (Settings library) — the server clones it into
  // this curriculum as a fresh, independent pathway. The wire field stays `pathwayId`.
  importPathway: (curriculumId, pathwayId) =>
    api.post(`${base(curriculumId)}/pathways/import`, { pathwayId }).then((r) => r.data.data),

  /* Progression Ladder */
  getLadder: (curriculumId) =>
    api.get(`${base(curriculumId)}/ladder`).then((r) => r.data.data),

  updateLadder: (curriculumId, rungs) =>
    api.put(`${base(curriculumId)}/ladder`, { rungs }).then((r) => r.data.data),

  // Indicators actually tagged in this curriculum's attached assessments, grouped by
  // competency (computed live) — feeds the Performance Bands indicator picker.
  getPopulatedIndicators: (curriculumId) =>
    api.get(`${base(curriculumId)}/populated-indicators`).then((r) => r.data.data),

  // Persisted marks-earned per indicator (Engine 5 framework), joined against live marksPossible.
  getIndicatorAchievements: (curriculumId) =>
    api.get(`${base(curriculumId)}/indicator-achievements`).then((r) => r.data.data),

  setIndicatorAchievement: (curriculumId, indicatorId, competencyId, marksEarned) =>
    api.put(`${base(curriculumId)}/indicator-achievements/${indicatorId}`, { competencyId, marksEarned }).then((r) => r.data.data),

  // Computed score per adopted competency (Engine 5 → Engine 3), with resolved level/band.
  // ageCategoryId is required now that Performance Bands are scoped per Developmental Stage.
  getCompetencyScores: (curriculumId, ageCategoryId) =>
    api.get(`${base(curriculumId)}/scores`, { params: { ageCategoryId } }).then((r) => r.data.data),

  // Real per-learner sibling of the above — this learner's own graded work run through the
  // same Evidence Type → Assessment Type → Engine 1/2/5/3 pipeline, instead of the shared
  // curriculum-wide manual preview value.
  getLearnerCompetencyScores: (curriculumId, learnerId) =>
    api.get(`${base(curriculumId)}/scores/learner/${learnerId}`).then((r) => r.data.data),

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

  calculateScore: (curriculumId, atId, evidenceScores, ageCategoryId) =>
    api.post(`/api/curricula/${curriculumId}/assessments/types/${atId}/calculate`, { evidenceScores, ageCategoryId }).then((r) => r.data.data),

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

  reorderPerformanceBands: (curriculumId, ageCategoryId, orderedIds) =>
    api.put(`/api/curricula/${curriculumId}/competencies/bands/reorder`, { ageCategoryId, orderedIds }).then((r) => r.data.data),

  // Copies a configured band's competencies, indicator weights and advancement thresholds onto
  // the next band in the same stage's ladder (Explorer -> Builder).
  duplicatePerformanceBandToNext: (curriculumId, bandId) =>
    api.post(`/api/curricula/${curriculumId}/competencies/bands/${bandId}/duplicate-to-next`).then((r) => r.data.data),

  // Indicator-driven band completion, computed from persisted indicator-achievements.
  // ageCategoryId is required now that Performance Bands are scoped per Developmental Stage.
  getBandProgress: (curriculumId, ageCategoryId) =>
    api.get(`${base(curriculumId)}/bands/progress`, { params: { ageCategoryId } }).then((r) => r.data.data),

  // Real per-learner sibling — this learner's own accumulating indicator progress instead of
  // the shared curriculum-wide manual store.
  getLearnerBandProgress: (curriculumId, learnerId) =>
    api.get(`${base(curriculumId)}/bands/progress/learner/${learnerId}`).then((r) => r.data.data),

  /* Pathway — per-learner, per-Pathway placement/history */
  getPathway: (curriculumId, learnerId) =>
    api.get(`${base(curriculumId)}/pathway-placement/${learnerId}`).then((r) => r.data.data),

  placeLearner: (curriculumId, learnerId, areaId, data) =>
    api.post(`${base(curriculumId)}/pathway-placement/${learnerId}/${areaId}`, data).then((r) => r.data.data),
};
