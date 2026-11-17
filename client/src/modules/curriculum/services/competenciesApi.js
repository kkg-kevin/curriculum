import api, { checkDelete } from "../../../services/api";

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
  checkUnlinkCompetency: (curriculumId, competencyId) => checkDelete(`${base(curriculumId)}/links/${competencyId}`),






  /* Pathways — this curriculum's own roadmaps (courses + diagnostic + age + placement) */
  getPathways: (curriculumId) =>
    api.get(`${base(curriculumId)}/pathways`).then((r) => r.data.data),

  createPathway: (curriculumId, data) =>
    api.post(`${base(curriculumId)}/pathways`, data).then((r) => r.data.data),

  updatePathway: (curriculumId, pathwayId, data) =>
    api.put(`${base(curriculumId)}/pathways/${pathwayId}`, data).then((r) => r.data.data),

  deletePathway: (curriculumId, pathwayId) =>
    api.delete(`${base(curriculumId)}/pathways/${pathwayId}`).then((r) => r.data),
  checkDeletePathway: (curriculumId, pathwayId) => checkDelete(`${base(curriculumId)}/pathways/${pathwayId}`),




  // Indicators actually tagged in this curriculum's attached assessments, grouped by
  // competency (computed live) — feeds the Performance Bands indicator picker.
  getPopulatedIndicators: (curriculumId) =>
    api.get(`${base(curriculumId)}/populated-indicators`).then((r) => r.data.data),




  // Real per-learner sibling of the above — this learner's own graded work run through the
  // same Evidence Type → Assessment Type → Engine 1/2/5/3 pipeline, instead of the shared
  // curriculum-wide manual preview value.
  // `hubId` — the hub the profile shows: a learner at two hubs running this curriculum can be in a
  // different stage at each, and the stage decides the bands.
  getLearnerCompetencyScores: (curriculumId, learnerId, hubId) =>
    api.get(`${base(curriculumId)}/scores/learner/${learnerId}`, { params: hubId ? { hubId } : {} }).then((r) => r.data.data),

  /* Age Categories */
  getAgeCategories: (curriculumId) =>
    api.get(`${base(curriculumId)}/age-categories`).then((r) => r.data.data),

  createAgeCategory: (curriculumId, data) =>
    api.post(`${base(curriculumId)}/age-categories`, data).then((r) => r.data.data),

  updateAgeCategory: (curriculumId, acId, data) =>
    api.put(`${base(curriculumId)}/age-categories/${acId}`, data).then((r) => r.data.data),

  deleteAgeCategory: (curriculumId, acId) =>
    api.delete(`${base(curriculumId)}/age-categories/${acId}`).then((r) => r.data),
  checkDeleteAgeCategory: (curriculumId, acId) => checkDelete(`${base(curriculumId)}/age-categories/${acId}`),

  /* Progress Levels */
  getProgressLevels: (curriculumId) =>
    api.get(`${base(curriculumId)}/levels`).then((r) => r.data.data),




  /* Assessment Framework — Assessment Types */
  getAssessmentTypes: (curriculumId) =>
    api.get(`/api/curricula/${curriculumId}/assessments/types`).then((r) => r.data.data),

  createAssessmentType: (curriculumId, data) =>
    api.post(`/api/curricula/${curriculumId}/assessments/types`, data).then((r) => r.data.data),

  updateAssessmentType: (curriculumId, atId, data) =>
    api.put(`/api/curricula/${curriculumId}/assessments/types/${atId}`, data).then((r) => r.data.data),

  deleteAssessmentType: (curriculumId, atId) =>
    api.delete(`/api/curricula/${curriculumId}/assessments/types/${atId}`).then((r) => r.data),



  updateGlobalScoring: (curriculumId, assessmentTypes, competencyWeights = []) =>
    api.put(`/api/curricula/${curriculumId}/assessments/scoring`, { assessmentTypes, competencyWeights }).then((r) => r.data.data),


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
  checkDeletePerformanceBand: (curriculumId, bandId) => checkDelete(`/api/curricula/${curriculumId}/competencies/bands/${bandId}`),

  reorderPerformanceBands: (curriculumId, ageCategoryId, orderedIds) =>
    api.put(`/api/curricula/${curriculumId}/competencies/bands/reorder`, { ageCategoryId, orderedIds }).then((r) => r.data.data),

  // Copies a configured band's competencies, indicator weights and advancement thresholds onto
  // the next band in the same stage's ladder (Explorer -> Builder).
  duplicatePerformanceBandToNext: (curriculumId, bandId) =>
    api.post(`/api/curricula/${curriculumId}/competencies/bands/${bandId}/duplicate-to-next`).then((r) => r.data.data),

  // Pathway sibling — same copy, but onto the next COURSE in the same pathway's ladder.
  duplicatePathwayBandToNext: (curriculumId, bandId) =>
    api.post(`/api/curricula/${curriculumId}/competencies/pathway-bands/${bandId}/duplicate-to-next`).then((r) => r.data.data),

  // Indicator-driven band completion, computed from persisted indicator-achievements.
  // ageCategoryId is required now that Performance Bands are scoped per Developmental Stage.
  getBandProgress: (curriculumId, ageCategoryId) =>
    api.get(`${base(curriculumId)}/bands/progress`, { params: { ageCategoryId } }).then((r) => r.data.data),

  // Real per-learner sibling — this learner's own accumulating indicator progress instead of
  // the shared curriculum-wide manual store.
  getLearnerBandProgress: (curriculumId, learnerId, hubId) =>
    api.get(`${base(curriculumId)}/bands/progress/learner/${learnerId}`, { params: hubId ? { hubId } : {} }).then((r) => r.data.data),

  /* Pathway — course sequence + indicator-contribution/threshold progress (same Engine 4 shape
   * as Performance Bands above, scoped to one Pathway's course ladder instead of a stage's). */
  reorderPathwayCourses: (curriculumId, pathwayId, orderedIds) =>
    api.put(`${base(curriculumId)}/pathways/${pathwayId}/courses/reorder`, { orderedIds }).then((r) => r.data.data),


  /* Pathway — per-learner, per-Pathway placement/history */
  getPathway: (curriculumId, learnerId) =>
    api.get(`${base(curriculumId)}/pathway-placement/${learnerId}`).then((r) => r.data.data),


  /* Pathways staff assign a learner by hand, alongside the automatic (stage) one */
  assignLearnerPathway: (curriculumId, learnerId, pathwayId) =>
    api.post(`${base(curriculumId)}/learner-pathways/${learnerId}`, { pathwayId }).then((r) => r.data.data),

  removeLearnerPathway: (curriculumId, learnerId, pathwayId) =>
    api.delete(`${base(curriculumId)}/learner-pathways/${learnerId}/${pathwayId}`).then((r) => r.data),
};
