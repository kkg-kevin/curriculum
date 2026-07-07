const CurriculumModel        = require("../curriculum.model");
const CurriculumCompetencyLinkModel = require("./curriculum-competency-link.model");
const CurriculumCompetencyIndicatorModel = require("./curriculum-competency-indicator.model");
const LearningAreaModel      = require("./learning-area.model");
const LearningAreaCatalogModel = require("../../settings/learning-areas/learning-area.model");
const CompetencyModel        = require("../../settings/competencies/competency.model");
const ProgressionLadderModel = require("./progression-ladder.model");
const AgeCategoryModel       = require("./age-category.model");
const ProgressLevelModel     = require("./progress-level.model");
const AssessmentModel        = require("./assessment.model");
const AssessmentTypeModel    = require("./assessment-type.model");
const EvidenceTypeModel      = require("./evidence-type.model");
const PerformanceBandModel   = require("./performance-band.model");
const { runAssessmentEngine, runCompetencyEngine, runProgressArcEngine } = require("./scoring-engines");

const DEFAULT_RUNGS = [
  { label: "Early Childhood",  ageRange: "3–5",   order: 1 },
  { label: "Lower Primary",    ageRange: "6–8",   order: 2 },
  { label: "Upper Primary",    ageRange: "9–11",  order: 3 },
  { label: "Lower Secondary",  ageRange: "12–14", order: 4 },
  { label: "Upper Secondary",  ageRange: "15–18", order: 5 },
];

const CompetencyService = {
  /* ── Curriculum ↔ Competency links ───────────────────────────────────
   * Competencies are now authored globally (see server/src/modules/competencies).
   * A curriculum no longer owns competency records — it just adopts entries
   * from the shared catalog. */

  getCurriculumCompetencies(curriculumId) {
    const links = CurriculumCompetencyLinkModel.findByCurriculumId(curriculumId);
    const comps = CompetencyModel.findByIds(links.map((l) => l.competencyId));
    return comps.map((c) => {
      const link = links.find((l) => l.competencyId === c.id);
      return {
        ...c,
        minimumThreshold: link?.minimumThreshold ?? 60,
        weight: link?.weight ?? 0,
      };
    });
  },

  linkCompetency(curriculumId, competencyId) {
    const comp = CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    CurriculumCompetencyLinkModel.link(curriculumId, competencyId);
    return this.getCurriculumCompetencies(curriculumId);
  },

  unlinkCompetency(curriculumId, competencyId) {
    CurriculumCompetencyLinkModel.unlink(curriculumId, competencyId);
    CurriculumCompetencyIndicatorModel.deleteByLink(curriculumId, competencyId);
    // This curriculum no longer uses the competency — drop it from this curriculum's
    // own progression ladder too (other curricula's ladders are untouched).
    const rungs = ProgressionLadderModel.findByCurriculumId(curriculumId);
    rungs.forEach((rung) => {
      const filtered = (rung.assignments || []).filter((a) => a.competencyId !== competencyId);
      if (filtered.length !== (rung.assignments || []).length) {
        ProgressionLadderModel.update(rung.id, { assignments: filtered });
      }
    });
    return this.getCurriculumCompetencies(curriculumId);
  },

  updateCompetencyLink(curriculumId, competencyId, data) {
    const link = CurriculumCompetencyLinkModel.updateLink(curriculumId, competencyId, data);
    if (!link) {
      const err = new Error("This curriculum hasn't adopted that competency yet");
      err.statusCode = 404;
      throw err;
    }
    return this.getCurriculumCompetencies(curriculumId);
  },

  /* ── Competency Indicators (how THIS curriculum evaluates an adopted competency) ── */

  getCompetencyIndicators(curriculumId, competencyId) {
    if (!CurriculumCompetencyLinkModel.findOne(curriculumId, competencyId)) {
      const err = new Error("This curriculum hasn't adopted that competency yet");
      err.statusCode = 404;
      throw err;
    }
    return CurriculumCompetencyIndicatorModel.findByLink(curriculumId, competencyId);
  },

  createCompetencyIndicator(curriculumId, competencyId, data) {
    if (!CurriculumCompetencyLinkModel.findOne(curriculumId, competencyId)) {
      const err = new Error("This curriculum hasn't adopted that competency yet");
      err.statusCode = 404;
      throw err;
    }
    return CurriculumCompetencyIndicatorModel.create({ curriculumId, competencyId, ...data });
  },

  updateCompetencyIndicator(curriculumId, competencyId, id, data) {
    const indicator = CurriculumCompetencyIndicatorModel.findById(id);
    if (!indicator || indicator.curriculumId !== curriculumId || indicator.competencyId !== competencyId) {
      const err = new Error("Indicator not found");
      err.statusCode = 404;
      throw err;
    }
    return CurriculumCompetencyIndicatorModel.update(id, data);
  },

  deleteCompetencyIndicator(curriculumId, competencyId, id) {
    const indicator = CurriculumCompetencyIndicatorModel.findById(id);
    if (!indicator || indicator.curriculumId !== curriculumId || indicator.competencyId !== competencyId) {
      const err = new Error("Indicator not found");
      err.statusCode = 404;
      throw err;
    }
    CurriculumCompetencyIndicatorModel.delete(id);
  },

  /* ── Learning Areas ─────────────────────────────────────────────────── */

  getLearningAreas(curriculumId) {
    return LearningAreaModel.findByCurriculumId(curriculumId);
  },

  createLearningArea(curriculumId, data) {
    const existing = LearningAreaModel.findByCurriculumId(curriculumId);
    if (existing.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("A learning area with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return LearningAreaModel.create({ curriculumId, ...data });
  },

  updateLearningArea(curriculumId, id, data) {
    const area = LearningAreaModel.findById(id);
    if (!area || area.curriculumId !== curriculumId) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const others = LearningAreaModel.findByCurriculumId(curriculumId).filter((a) => a.id !== id);
      if (others.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("A learning area with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return LearningAreaModel.update(id, data);
  },

  deleteLearningArea(curriculumId, id) {
    const area = LearningAreaModel.findById(id);
    if (!area || area.curriculumId !== curriculumId) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    LearningAreaModel.delete(id);
  },

  // Clones a catalog entry (authored in Settings) into a new, independent record
  // owned by this curriculum — not a link. Once imported, editing this curriculum's
  // copy never touches the Settings default, and vice versa.
  importLearningArea(curriculumId, learningAreaId) {
    const source = LearningAreaCatalogModel.findById(learningAreaId);
    if (!source) {
      const err = new Error("Learning area not found in catalog");
      err.statusCode = 404;
      throw err;
    }
    return this.createLearningArea(curriculumId, {
      name:        source.name,
      description: source.description,
      color:       source.color,
      courses:     source.courses,
    });
  },

  /* ── Progression Ladder ─────────────────────────────────────────────── */

  getLadder(curriculumId) {
    let rungs = ProgressionLadderModel.findByCurriculumId(curriculumId);
    if (rungs.length === 0) {
      rungs = DEFAULT_RUNGS.map((r) =>
        ProgressionLadderModel.create({ curriculumId, ...r, assignments: [] })
      );
    }
    return rungs.sort((a, b) => a.order - b.order);
  },

  updateLadder(curriculumId, rungs) {
    rungs.forEach((rung) => {
      const existing = ProgressionLadderModel.findById(rung.id);
      if (existing && existing.curriculumId === curriculumId) {
        ProgressionLadderModel.update(rung.id, {
          label:       rung.label,
          ageRange:    rung.ageRange,
          assignments: rung.assignments,
        });
      }
    });
    return ProgressionLadderModel.findByCurriculumId(curriculumId).sort(
      (a, b) => a.order - b.order
    );
  },

  /* ── Age Categories ─────────────────────────────────────────────────── */

  getAgeCategories(curriculumId) {
    return AgeCategoryModel.findByCurriculumId(curriculumId);
  },

  createAgeCategory(curriculumId, data) {
    const existing = AgeCategoryModel.findByCurriculumId(curriculumId);
    if (existing.some((c) => c.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("An age category with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return AgeCategoryModel.create({ curriculumId, ...data });
  },

  updateAgeCategory(curriculumId, id, data) {
    const cat = AgeCategoryModel.findById(id);
    if (!cat || cat.curriculumId !== curriculumId) {
      const err = new Error("Age category not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const others = AgeCategoryModel.findByCurriculumId(curriculumId).filter((c) => c.id !== id);
      if (others.some((c) => c.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("An age category with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return AgeCategoryModel.update(id, data);
  },

  deleteAgeCategory(curriculumId, id) {
    const cat = AgeCategoryModel.findById(id);
    if (!cat || cat.curriculumId !== curriculumId) {
      const err = new Error("Age category not found");
      err.statusCode = 404;
      throw err;
    }
    AgeCategoryModel.delete(id);
  },

  /* ── Progress Levels ────────────────────────────────────────────────── */

  getProgressLevels(curriculumId) {
    return ProgressLevelModel.findByCurriculumId(curriculumId);
  },

  createProgressLevel(curriculumId, data) {
    const existing = ProgressLevelModel.findByCurriculumId(curriculumId);
    if (existing.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("A level with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return ProgressLevelModel.create({ curriculumId, ...data });
  },

  updateProgressLevel(curriculumId, id, data) {
    const level = ProgressLevelModel.findById(id);
    if (!level || level.curriculumId !== curriculumId) {
      const err = new Error("Level not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const others = ProgressLevelModel.findByCurriculumId(curriculumId).filter((l) => l.id !== id);
      if (others.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("A level with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return ProgressLevelModel.update(id, data);
  },

  deleteProgressLevel(curriculumId, id) {
    const level = ProgressLevelModel.findById(id);
    if (!level || level.curriculumId !== curriculumId) {
      const err = new Error("Level not found");
      err.statusCode = 404;
      throw err;
    }
    ProgressLevelModel.delete(id);
  },

  /* ── Assessments ────────────────────────────────────────────────────── */

  getAssessments(curriculumId) {
    return AssessmentModel.findByCurriculumId(curriculumId);
  },

  createAssessment(curriculumId, data) {
    return AssessmentModel.create({ curriculumId, ...data });
  },

  updateAssessment(curriculumId, id, data) {
    const item = AssessmentModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }
    return AssessmentModel.update(id, data);
  },

  deleteAssessment(curriculumId, id) {
    const item = AssessmentModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Assessment not found");
      err.statusCode = 404;
      throw err;
    }
    AssessmentModel.delete(id);
  },

  /* ── Assessment Types ───────────────────────────────────────────────── */

  getAssessmentTypes(curriculumId) {
    return AssessmentTypeModel.findByCurriculumId(curriculumId);
  },

  createAssessmentType(curriculumId, data) {
    const existing = AssessmentTypeModel.findByCurriculumId(curriculumId);
    if (existing.some((t) => t.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("An assessment type with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return AssessmentTypeModel.create({ curriculumId, ...data });
  },

  updateAssessmentType(curriculumId, id, data) {
    const item = AssessmentTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Assessment type not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const others = AssessmentTypeModel.findByCurriculumId(curriculumId).filter((t) => t.id !== id);
      if (others.some((t) => t.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("An assessment type with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return AssessmentTypeModel.update(id, data);
  },

  deleteAssessmentType(curriculumId, id) {
    const item = AssessmentTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Assessment type not found");
      err.statusCode = 404;
      throw err;
    }
    AssessmentTypeModel.delete(id);
  },

  updateScoring(curriculumId, id, evidenceWeights) {
    const item = AssessmentTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Assessment type not found");
      err.statusCode = 404;
      throw err;
    }
    return AssessmentTypeModel.update(id, { evidenceWeights });
  },

  updateGlobalScoring(curriculumId, assessmentTypes, competencyWeights = []) {
    // Tier-1: each type's evidence weights must independently sum to 100% (if any assigned)
    for (const atConfig of assessmentTypes) {
      const at = AssessmentTypeModel.findById(atConfig.id);
      if (!at || at.curriculumId !== curriculumId) {
        const err = new Error(`Assessment type not found: ${atConfig.id}`);
        err.statusCode = 404;
        throw err;
      }
      if (atConfig.evidenceWeights.length === 0) continue;
      const evTotal = atConfig.evidenceWeights.reduce((sum, w) => sum + w.contribution, 0);
      if (Math.round(evTotal) !== 100) {
        const err = new Error(`"${at.name}" evidence contributions must total exactly 100% (currently ${Math.round(evTotal)}%)`);
        err.statusCode = 422;
        throw err;
      }
    }
    for (const atConfig of assessmentTypes) {
      AssessmentTypeModel.update(atConfig.id, { typeWeight: atConfig.typeWeight, evidenceWeights: atConfig.evidenceWeights });
    }
    // Tier-3: persist competency weights on the curriculum
    CurriculumModel.update(curriculumId, { competencyWeights });
    return {
      assessmentTypes:   AssessmentTypeModel.findByCurriculumId(curriculumId),
      competencyWeights,
    };
  },

  getCompetencyWeights(curriculumId) {
    const curriculum = CurriculumModel.findById(curriculumId);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return curriculum.competencyWeights || [];
  },

  calculateScore(curriculumId, id, evidenceScores) {
    const assessmentType = AssessmentTypeModel.findById(id);
    if (!assessmentType || assessmentType.curriculumId !== curriculumId) {
      const err = new Error("Assessment type not found");
      err.statusCode = 404;
      throw err;
    }

    const evidenceTypes    = EvidenceTypeModel.findByCurriculumId(curriculumId);
    const competencies     = this.getCurriculumCompetencies(curriculumId);
    const performanceBands = PerformanceBandModel.findByCurriculum(curriculumId);
    const progressLevels   = ProgressLevelModel.findByCurriculumId(curriculumId);
    const config           = assessmentType.evidenceWeights || [];

    // Engine 1 — weighted evidence scores
    const { finalScore, breakdown: rawBreakdown, belowReq } = runAssessmentEngine(evidenceScores, config);

    // Enrich breakdown with evidence names and evidence-type min requirements
    const breakdown = rawBreakdown.map((row) => {
      const et     = evidenceTypes.find((e) => e.id === row.evidenceTypeId);
      const minReq = row.minRequirement > 0 ? row.minRequirement : (et?.minRequirement ?? 0);
      return { ...row, name: et?.name || "Unknown", minRequirement: minReq, belowMin: row.score < minReq };
    });
    const belowRequirement = breakdown.filter((r) => r.belowMin);

    // Engine 2 — competency distribution + normalization
    const competencyScores = runCompetencyEngine(breakdown, config, competencies);

    // Engine 3 — map competency scores to levels and bands
    const rawCompetencyBreakdown = runProgressArcEngine(competencyScores, progressLevels, performanceBands);

    // Competency gate — check each competency against its minimumThreshold
    const competencyBreakdown = rawCompetencyBreakdown.map((cr) => {
      const comp      = competencies.find((c) => c.id === cr.competencyId);
      const threshold = comp?.minimumThreshold ?? 60;
      return { ...cr, threshold, thresholdMet: cr.score >= threshold };
    });
    const allCompetenciesMet = competencyBreakdown.length > 0 && competencyBreakdown.every((cr) => cr.thresholdMet);

    // Overall band for the final score
    const band = [...performanceBands]
      .sort((a, b) => a.minScore - b.minScore)
      .find((b) => finalScore >= b.minScore && finalScore <= b.maxScore) || null;

    const behaviorType = assessmentType.behaviorType || "formative";

    const failedCompetencies = competencyBreakdown.filter((cr) => !cr.thresholdMet);

    let outcome;
    if (behaviorType === "diagnostic") {
      outcome = { type: "placement",        label: band ? `Placement: ${band.name} level` : "No band matched" };
    } else if (!allCompetenciesMet && failedCompetencies.length > 0 && behaviorType === "summative") {
      outcome = { type: "cannot_progress",  label: `Cannot progress — ${failedCompetencies.length} competenc${failedCompetencies.length !== 1 ? "ies" : "y"} below threshold` };
    } else if (belowRequirement.length > 0 && behaviorType === "summative") {
      outcome = { type: "cannot_progress",  label: "Cannot progress to next level" };
    } else if (belowRequirement.length > 0) {
      outcome = { type: "below_requirement", label: "Some evidence types below minimum requirement" };
    } else if (allCompetenciesMet) {
      outcome = { type: "passed",           label: "All competencies met — learner can progress" };
    } else {
      outcome = { type: "passed",           label: "All requirements met" };
    }

    const hasCompetencyMappings = config.some((c) => (c.competencyMappings || []).length > 0);

    return {
      finalScore, breakdown, belowRequirement,
      band, behaviorType, outcome,
      competencyBreakdown, failedCompetencies, allCompetenciesMet, hasCompetencyMappings,
    };
  },

  /* ── Evidence Types ─────────────────────────────────────────────────── */

  getEvidenceTypes(curriculumId) {
    return EvidenceTypeModel.findByCurriculumId(curriculumId);
  },

  createEvidenceType(curriculumId, data) {
    const existing = EvidenceTypeModel.findByCurriculumId(curriculumId);
    if (existing.some((e) => e.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("An evidence type with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return EvidenceTypeModel.create({ curriculumId, ...data });
  },

  updateEvidenceType(curriculumId, id, data) {
    const item = EvidenceTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Evidence type not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const others = EvidenceTypeModel.findByCurriculumId(curriculumId).filter((e) => e.id !== id);
      if (others.some((e) => e.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("An evidence type with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return EvidenceTypeModel.update(id, data);
  },

  /* ── Performance Bands ──────────────────────────────────────────────── */

  getPerformanceBands(curriculumId) {
    return PerformanceBandModel.findByCurriculum(curriculumId);
  },

  createPerformanceBand(curriculumId, data) {
    return PerformanceBandModel.create(curriculumId, data);
  },

  updatePerformanceBand(curriculumId, id, data) {
    const band = PerformanceBandModel.update(curriculumId, id, data);
    if (!band) {
      const err = new Error("Performance band not found");
      err.statusCode = 404;
      throw err;
    }
    return band;
  },

  deletePerformanceBand(curriculumId, id) {
    PerformanceBandModel.delete(curriculumId, id);
  },

  reorderPerformanceBands(curriculumId, orderedIds) {
    return PerformanceBandModel.reorder(curriculumId, orderedIds);
  },

  deleteEvidenceType(curriculumId, id) {
    const item = EvidenceTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Evidence type not found");
      err.statusCode = 404;
      throw err;
    }
    EvidenceTypeModel.delete(id);
    // Remove this evidence type from all assessment type scoring configs
    AssessmentTypeModel.findByCurriculumId(curriculumId).forEach((at) => {
      const filtered = (at.evidenceWeights || []).filter((w) => w.evidenceTypeId !== id);
      if (filtered.length !== (at.evidenceWeights || []).length) {
        AssessmentTypeModel.update(at.id, { evidenceWeights: filtered });
      }
    });
  },

};

module.exports = CompetencyService;
