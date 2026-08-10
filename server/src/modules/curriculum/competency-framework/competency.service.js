const CurriculumModel        = require("../curriculum.model");
const CurriculumCompetencyLinkModel = require("./curriculum-competency-link.model");
const CurriculumCompetencyIndicatorModel = require("./curriculum-competency-indicator.model");
const LearningAreaModel      = require("./learning-area.model");
const LearningAreaCatalogModel = require("../../settings/learning-areas/learning-area.model");
const CourseModel            = require("../../courses/course.model");
const CompetencyModel        = require("../../settings/competencies/competency.model");
const ProgressionLadderModel = require("./progression-ladder.model");
const AgeCategoryModel       = require("./age-category.model");
const ProgressLevelModel     = require("./progress-level.model");
const AssessmentTypeModel    = require("./assessment-type.model");
const EvidenceTypeModel      = require("./evidence-type.model");
const PerformanceBandModel   = require("./performance-band.model");
const { runAssessmentEngine, runCompetencyEngine, runProgressArcEngine, runIndicatorProgressEngine } = require("./scoring-engines");
const IndicatorAchievementModel = require("./indicator-achievement.model");
const SessionModel                   = require("../../courses/session.model");
const { getSessionAssessmentIds } = require("../../courses/sessionAssessment.utils");
const CourseCurriculumLinkModel      = require("../../courses/course-curriculum-link.model");
const BuilderAssessmentModel         = require("../../assessments/assessment.model");
const AssessmentCompetencyLinkModel  = require("../../assessments/assessment-competency-link.model");
const CurriculumVersionModel         = require("../versions/curriculum-versions.model");
const LearnerJourneyModel            = require("./learner-journey.model");
const LearnerModel                   = require("../../learners/learner.model");
const LearnerHubLinkModel            = require("../../learners/learner-hub-link.model");
const ClassModel                     = require("../../classes/class.model");
// Required lazily (inside the functions that use it, not here) — assessment-submission.service.js
// already requires this file back (for diagnostic placement), and capturing a top-level reference
// to it here would risk resolving to a stale/incomplete export depending on which module happens
// to load first at server startup.

// A Learning Area's `courses` field stores course ids only — reject anything
// that doesn't resolve to a real course so a dummy id can never sneak in.
async function assertCoursesExist(courseIds) {
  if (!courseIds) return;
  const found = await Promise.all(courseIds.map((id) => CourseModel.findById(id)));
  const missing = courseIds.filter((id, i) => !found[i]);
  if (missing.length > 0) {
    const err = new Error(`Course(s) not found: ${missing.join(", ")}`);
    err.statusCode = 404;
    throw err;
  }
}

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

  async getCurriculumCompetencies(curriculumId) {
    const links = await CurriculumCompetencyLinkModel.findByCurriculumId(curriculumId);
    const comps = await CompetencyModel.findByIds(links.map((l) => l.competencyId));
    const linksByCompetencyId = new Map(links.map((l) => [l.competencyId, l]));
    return comps.map((c) => {
      const link = linksByCompetencyId.get(c.id);
      return {
        ...c,
        minimumThreshold: link?.minimumThreshold ?? 60,
      };
    });
  },

  async linkCompetency(curriculumId, competencyId) {
    const comp = await CompetencyModel.findById(competencyId);
    if (!comp) {
      const err = new Error("Competency not found");
      err.statusCode = 404;
      throw err;
    }
    await CurriculumCompetencyLinkModel.link(curriculumId, competencyId);
    return this.getCurriculumCompetencies(curriculumId);
  },

  async unlinkCompetency(curriculumId, competencyId) {
    await CurriculumCompetencyLinkModel.unlink(curriculumId, competencyId);
    await CurriculumCompetencyIndicatorModel.deleteByLink(curriculumId, competencyId);
    await IndicatorAchievementModel.deleteByLink(curriculumId, competencyId);
    // This curriculum no longer uses the competency — drop it from this curriculum's
    // own progression ladder too (other curricula's ladders are untouched).
    const rungs = await ProgressionLadderModel.findByCurriculumId(curriculumId);
    await Promise.all(rungs.map((rung) => {
      const filtered = (rung.assignments || []).filter((a) => a.competencyId !== competencyId);
      if (filtered.length !== (rung.assignments || []).length) {
        return ProgressionLadderModel.update(rung.id, { assignments: filtered });
      }
      return null;
    }));
    return this.getCurriculumCompetencies(curriculumId);
  },

  async updateCompetencyLink(curriculumId, competencyId, data) {
    const link = await CurriculumCompetencyLinkModel.updateLink(curriculumId, competencyId, data);
    if (!link) {
      const err = new Error("This curriculum hasn't adopted that competency yet");
      err.statusCode = 404;
      throw err;
    }
    return this.getCurriculumCompetencies(curriculumId);
  },

  /* ── Competency Indicators (how THIS curriculum evaluates an adopted competency) ── */

  async getCompetencyIndicators(curriculumId, competencyId) {
    if (!(await CurriculumCompetencyLinkModel.findOne(curriculumId, competencyId))) {
      const err = new Error("This curriculum hasn't adopted that competency yet");
      err.statusCode = 404;
      throw err;
    }
    const existing = await CurriculumCompetencyIndicatorModel.findByLink(curriculumId, competencyId);
    if (existing.length > 0) return existing;

    // First time this curriculum's indicators are viewed for this competency — seed them
    // from the global competency's base indicators (Settings), split evenly to 100% as a
    // starting point. From here they're this curriculum's own copies: editing, reweighting,
    // adding, or deleting them never touches the global catalog.
    const competency = await CompetencyModel.findById(competencyId);
    const globalIndicators = competency?.indicators || [];
    if (globalIndicators.length === 0) return [];

    const evenWeight = Math.floor(100 / globalIndicators.length);
    const remainder  = 100 - evenWeight * globalIndicators.length;
    return Promise.all(globalIndicators.map((gi, idx) =>
      CurriculumCompetencyIndicatorModel.create({
        curriculumId,
        competencyId,
        name:        gi.name,
        description: gi.description || "",
        weight:      evenWeight + (idx === globalIndicators.length - 1 ? remainder : 0),
      })
    ));
  },

  async createCompetencyIndicator(curriculumId, competencyId, data) {
    if (!(await CurriculumCompetencyLinkModel.findOne(curriculumId, competencyId))) {
      const err = new Error("This curriculum hasn't adopted that competency yet");
      err.statusCode = 404;
      throw err;
    }
    return CurriculumCompetencyIndicatorModel.create({ curriculumId, competencyId, ...data });
  },

  async updateCompetencyIndicator(curriculumId, competencyId, id, data) {
    const indicator = await CurriculumCompetencyIndicatorModel.findById(id);
    if (!indicator || indicator.curriculumId !== curriculumId || indicator.competencyId !== competencyId) {
      const err = new Error("Indicator not found");
      err.statusCode = 404;
      throw err;
    }
    return CurriculumCompetencyIndicatorModel.update(id, data);
  },

  async deleteCompetencyIndicator(curriculumId, competencyId, id) {
    const indicator = await CurriculumCompetencyIndicatorModel.findById(id);
    if (!indicator || indicator.curriculumId !== curriculumId || indicator.competencyId !== competencyId) {
      const err = new Error("Indicator not found");
      err.statusCode = 404;
      throw err;
    }
    await CurriculumCompetencyIndicatorModel.delete(id);
  },

  /* ── Learning Areas ─────────────────────────────────────────────────── */

  async getLearningAreas(curriculumId) {
    return LearningAreaModel.findByCurriculumId(curriculumId);
  },

  async createLearningArea(curriculumId, data) {
    const existing = await LearningAreaModel.findByCurriculumId(curriculumId);
    if (existing.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("A learning area with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    await assertCoursesExist(data.courses);
    return LearningAreaModel.create({ curriculumId, ...data });
  },

  async updateLearningArea(curriculumId, id, data) {
    const area = await LearningAreaModel.findById(id);
    if (!area || area.curriculumId !== curriculumId) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const all = await LearningAreaModel.findByCurriculumId(curriculumId);
      const others = all.filter((a) => a.id !== id);
      if (others.some((a) => a.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("A learning area with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    await assertCoursesExist(data.courses);
    return LearningAreaModel.update(id, data);
  },

  async deleteLearningArea(curriculumId, id) {
    const area = await LearningAreaModel.findById(id);
    if (!area || area.curriculumId !== curriculumId) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    await LearningAreaModel.delete(id);
  },

  // Clones a catalog entry (authored in Settings) into a new, independent record
  // owned by this curriculum — not a link. Once imported, editing this curriculum's
  // copy never touches the Settings default, and vice versa.
  async importLearningArea(curriculumId, learningAreaId) {
    const source = await LearningAreaCatalogModel.findById(learningAreaId);
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

  async getLadder(curriculumId) {
    let rungs = await ProgressionLadderModel.findByCurriculumId(curriculumId);
    if (rungs.length === 0) {
      rungs = await Promise.all(DEFAULT_RUNGS.map((r) =>
        ProgressionLadderModel.create({ curriculumId, ...r, assignments: [] })
      ));
    }
    return rungs.sort((a, b) => a.order - b.order);
  },

  async updateLadder(curriculumId, rungs) {
    await Promise.all(rungs.map(async (rung) => {
      const existing = await ProgressionLadderModel.findById(rung.id);
      if (existing && existing.curriculumId === curriculumId) {
        await ProgressionLadderModel.update(rung.id, {
          label:       rung.label,
          ageRange:    rung.ageRange,
          assignments: rung.assignments,
        });
      }
    }));
    const updated = await ProgressionLadderModel.findByCurriculumId(curriculumId);
    return updated.sort((a, b) => a.order - b.order);
  },

  /* ── Age Categories ─────────────────────────────────────────────────── */

  async getAgeCategories(curriculumId) {
    return AgeCategoryModel.findByCurriculumId(curriculumId);
  },

  async createAgeCategory(curriculumId, data) {
    const existing = await AgeCategoryModel.findByCurriculumId(curriculumId);
    if (existing.some((c) => c.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("An age category with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return AgeCategoryModel.create({ curriculumId, ...data });
  },

  async updateAgeCategory(curriculumId, id, data) {
    const cat = await AgeCategoryModel.findById(id);
    if (!cat || cat.curriculumId !== curriculumId) {
      const err = new Error("Age category not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const all = await AgeCategoryModel.findByCurriculumId(curriculumId);
      const others = all.filter((c) => c.id !== id);
      if (others.some((c) => c.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("An age category with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return AgeCategoryModel.update(id, data);
  },

  async deleteAgeCategory(curriculumId, id) {
    const cat = await AgeCategoryModel.findById(id);
    if (!cat || cat.curriculumId !== curriculumId) {
      const err = new Error("Age category not found");
      err.statusCode = 404;
      throw err;
    }
    await AgeCategoryModel.delete(id);
  },

  /* ── Progress Levels ────────────────────────────────────────────────── */

  async getProgressLevels(curriculumId) {
    return ProgressLevelModel.findByCurriculumId(curriculumId);
  },

  async createProgressLevel(curriculumId, data) {
    const existing = await ProgressLevelModel.findByCurriculumId(curriculumId);
    if (existing.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("A level with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return ProgressLevelModel.create({ curriculumId, ...data });
  },

  async updateProgressLevel(curriculumId, id, data) {
    const level = await ProgressLevelModel.findById(id);
    if (!level || level.curriculumId !== curriculumId) {
      const err = new Error("Level not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const all = await ProgressLevelModel.findByCurriculumId(curriculumId);
      const others = all.filter((l) => l.id !== id);
      if (others.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("A level with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return ProgressLevelModel.update(id, data);
  },

  async deleteProgressLevel(curriculumId, id) {
    const level = await ProgressLevelModel.findById(id);
    if (!level || level.curriculumId !== curriculumId) {
      const err = new Error("Level not found");
      err.statusCode = 404;
      throw err;
    }
    await ProgressLevelModel.delete(id);
  },

  /* ── Assessment Types ───────────────────────────────────────────────── */

  async getAssessmentTypes(curriculumId) {
    return AssessmentTypeModel.findByCurriculumId(curriculumId);
  },

  async createAssessmentType(curriculumId, data) {
    const existing = await AssessmentTypeModel.findByCurriculumId(curriculumId);
    if (existing.some((t) => t.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("An assessment type with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return AssessmentTypeModel.create({ curriculumId, ...data });
  },

  async updateAssessmentType(curriculumId, id, data) {
    const item = await AssessmentTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Assessment type not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const all = await AssessmentTypeModel.findByCurriculumId(curriculumId);
      const others = all.filter((t) => t.id !== id);
      if (others.some((t) => t.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("An assessment type with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return AssessmentTypeModel.update(id, data);
  },

  async deleteAssessmentType(curriculumId, id) {
    const item = await AssessmentTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Assessment type not found");
      err.statusCode = 404;
      throw err;
    }
    await AssessmentTypeModel.delete(id);
  },

  async updateScoring(curriculumId, id, evidenceWeights) {
    const item = await AssessmentTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Assessment type not found");
      err.statusCode = 404;
      throw err;
    }
    return AssessmentTypeModel.update(id, { evidenceWeights });
  },

  async updateGlobalScoring(curriculumId, assessmentTypes, competencyWeights = []) {
    // Tier-1: each type's evidence weights must independently sum to 100% (if any assigned)
    for (const atConfig of assessmentTypes) {
      const at = await AssessmentTypeModel.findById(atConfig.id);
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
      await AssessmentTypeModel.update(atConfig.id, { typeWeight: atConfig.typeWeight, evidenceWeights: atConfig.evidenceWeights });
    }
    // Tier-3: persist competency weights on the curriculum
    await CurriculumModel.update(curriculumId, { competencyWeights });
    return {
      assessmentTypes:   await AssessmentTypeModel.findByCurriculumId(curriculumId),
      competencyWeights,
    };
  },

  async getCompetencyWeights(curriculumId) {
    const curriculum = await CurriculumModel.findById(curriculumId);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return curriculum.competencyWeights || [];
  },

  async calculateScore(curriculumId, id, evidenceScores, learnerId = null) {
    const assessmentType = await AssessmentTypeModel.findById(id);
    if (!assessmentType || assessmentType.curriculumId !== curriculumId) {
      const err = new Error("Assessment type not found");
      err.statusCode = 404;
      throw err;
    }

    const evidenceTypes    = await EvidenceTypeModel.findByCurriculumId(curriculumId);
    const competencies     = await this.getCurriculumCompetencies(curriculumId);
    // Learning-Area-scoped bands (Learning Journey's course ladders) share this same model
    // but shouldn't count toward the curriculum-wide Progress Arc band below.
    const allBands = await PerformanceBandModel.findByCurriculum(curriculumId);
    const performanceBands = allBands.filter((b) => !b.learningAreaId);
    const progressLevels   = await ProgressLevelModel.findByCurriculumId(curriculumId);
    const config           = assessmentType.evidenceWeights || [];

    // Engine 1 — weighted evidence scores
    const { finalScore, breakdown: rawBreakdown } = runAssessmentEngine(evidenceScores, config);

    // Enrich breakdown with evidence names
    const breakdown = rawBreakdown.map((row) => {
      const et = evidenceTypes.find((e) => e.id === row.evidenceTypeId);
      return { ...row, name: et?.name || "Unknown" };
    });

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
    } else if (allCompetenciesMet) {
      outcome = { type: "passed",           label: "All competencies met — learner can progress" };
    } else {
      outcome = { type: "passed",           label: "All requirements met" };
    }

    const hasCompetencyMappings = config.some((c) => (c.competencyMappings || []).length > 0);

    // Any assessment type tied to a Learning Area feeds the Learning Journey: a diagnostic
    // resolves and records an initial (or re-)placement outright, while ongoing formative/
    // summative work only ever advances a learner forward if this score clears the next
    // threshold up — it never moves them backward.
    let learningJourneyPlacement = null;
    if (assessmentType.learningAreaId && learnerId) {
      if (behaviorType === "diagnostic") {
        const courseId = await this.resolvePlacementFromScore(curriculumId, assessmentType.learningAreaId, finalScore);
        if (courseId) {
          const journey = await this.placeLearner(curriculumId, learnerId, assessmentType.learningAreaId, {
            courseId, reason: "diagnostic", assessmentId: id,
          });
          learningJourneyPlacement = { learningAreaId: assessmentType.learningAreaId, courseId, journey };
        }
      } else {
        const journey = await this.checkAdvancement(curriculumId, learnerId, assessmentType.learningAreaId, finalScore, id);
        if (journey) {
          learningJourneyPlacement = { learningAreaId: assessmentType.learningAreaId, courseId: journey.currentCourseId, journey };
        }
      }
    }

    return {
      finalScore, breakdown,
      band, behaviorType, outcome,
      competencyBreakdown, failedCompetencies, allCompetenciesMet, hasCompetencyMappings,
      learningJourneyPlacement,
    };
  },

  // Progress Arc — how much of each Performance Band a learner has completed, driven by
  // indicator-level achievement rather than the overall competency score (see
  // runIndicatorProgressEngine). `indicatorAchievements` is the learner's 0-100 achievement
  // per indicator (marks earned / marks possible across graded work); passed in manually for
  // now, same shape `calculateScore`'s `evidenceScores` takes for the evidence pipeline.
  async calculateIndicatorProgress(curriculumId, indicatorAchievements) {
    // Same Learning-Journey-band exclusion as calculateScore above — a scoped band has no
    // indicatorContributions of its own, so leaving it in would surface a bogus 100%-complete
    // entry (0 completion >= its 0 default threshold) alongside real Progress Arc bands.
    const allBands = await PerformanceBandModel.findByCurriculum(curriculumId);
    const performanceBands = allBands.filter((b) => !b.learningAreaId);
    return runIndicatorProgressEngine(indicatorAchievements, performanceBands);
  },

  /* ── Evidence Types ─────────────────────────────────────────────────── */

  async getEvidenceTypes(curriculumId) {
    return EvidenceTypeModel.findByCurriculumId(curriculumId);
  },

  async createEvidenceType(curriculumId, data) {
    const existing = await EvidenceTypeModel.findByCurriculumId(curriculumId);
    if (existing.some((e) => e.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("An evidence type with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return EvidenceTypeModel.create({ curriculumId, ...data });
  },

  async updateEvidenceType(curriculumId, id, data) {
    const item = await EvidenceTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Evidence type not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const all = await EvidenceTypeModel.findByCurriculumId(curriculumId);
      const others = all.filter((e) => e.id !== id);
      if (others.some((e) => e.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("An evidence type with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return EvidenceTypeModel.update(id, data);
  },

  /* ── Performance Bands ──────────────────────────────────────────────── */

  async getPerformanceBands(curriculumId) {
    return PerformanceBandModel.findByCurriculum(curriculumId);
  },

  async createPerformanceBand(curriculumId, data) {
    return PerformanceBandModel.create(curriculumId, data);
  },

  async updatePerformanceBand(curriculumId, id, data) {
    const band = await PerformanceBandModel.update(curriculumId, id, data);
    if (!band) {
      const err = new Error("Performance band not found");
      err.statusCode = 404;
      throw err;
    }
    return band;
  },

  async deletePerformanceBand(curriculumId, id) {
    await PerformanceBandModel.delete(curriculumId, id);
  },

  async reorderPerformanceBands(curriculumId, orderedIds) {
    return PerformanceBandModel.reorder(curriculumId, orderedIds);
  },

  // Indicators actually in use — tagged on at least one question/rubric criterion/
  // observation item of an assessment reachable from this curriculum's attached courses
  // (via both the flat "Attach Course" link and the current published Version Control
  // content). Always computed live, not stored — reflects whatever's currently tagged, so
  // a newly-tagged question shows up without re-attaching anything. Grouped by competency,
  // for the Performance Bands indicator picker (which should only offer these, not every
  // indicator a competency happens to define in Settings).
  // Every assessment id reachable from this curriculum's attached courses — via both the flat
  // "Attach Course" link and the current published Version Control content. Shared by
  // getPopulatedIndicators and getEvidenceTypeScores below.
  async getAttachedAssessmentIds(curriculumId) {
    const courseLinks = await CourseCurriculumLinkModel.findByCurriculumId(curriculumId);
    const courseIds = new Set(courseLinks.map((l) => l.courseId));
    const versions = await CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    const currentVersion = versions.find((v) => v.isCurrent);
    (currentVersion?.content || []).forEach((period) => {
      (period.classes || []).forEach((cls) => {
        (cls.courses || []).forEach((c) => courseIds.add(c.id));
      });
    });

    const assessmentIds = new Set();
    for (const courseId of courseIds) {
      const sessions = await SessionModel.findByCourseId(courseId);
      sessions.forEach((s) => {
        getSessionAssessmentIds(s).forEach((aid) => assessmentIds.add(aid));
      });
    }
    return assessmentIds;
  },

  async getPopulatedIndicators(curriculumId) {
    const assessmentIds = await this.getAttachedAssessmentIds(curriculumId);

    const usedIndicatorIds = new Set();
    const relevantCompetencyIds = new Set();
    // Marks possible per indicator — summed from `indicatorMarks` on items/rubric criteria
    // across every assessment attached to this curriculum. This is "marks possible," not
    // "marks earned" — there's no grading/submission data yet to compute actual achievement.
    const marksByIndicator = new Map();
    for (const aid of assessmentIds) {
      const assessment = await BuilderAssessmentModel.findById(aid);
      if (!assessment) continue;
      const compLinks = await AssessmentCompetencyLinkModel.findByAssessmentId(aid);
      compLinks.forEach((l) => relevantCompetencyIds.add(l.competencyId));

      const scoredEntries = [...(assessment.items || []), ...(assessment.rubric || [])];
      scoredEntries.forEach((entry) => {
        (entry.indicatorMarks || []).forEach(({ indicatorId, marks }) => {
          usedIndicatorIds.add(indicatorId);
          marksByIndicator.set(indicatorId, (marksByIndicator.get(indicatorId) || 0) + (Number(marks) || 0));
        });
      });

      (assessment.indicators || []).forEach((entry) => {
        (entry.competencyIndicatorIds || []).forEach((indId) => usedIndicatorIds.add(indId));
      });
    }

    const groups = [];
    for (const competencyId of relevantCompetencyIds) {
      const comp = await CompetencyModel.findById(competencyId);
      if (!comp) continue;
      const indicators = (comp.indicators || [])
        .filter((ind) => usedIndicatorIds.has(ind.id))
        .map((ind) => ({ ...ind, marksPossible: marksByIndicator.get(ind.id) || 0 }));
      if (indicators.length === 0) continue;
      groups.push({ competencyId, competencyName: comp.name, indicators });
    }

    return groups;
  },

  // ── Indicator Achievements — persisted marks-earned per indicator, joined against the live
  // marksPossible from getPopulatedIndicators above. Engine 5 aggregates these into
  // per-competency scores (feeding the Competencies tab); the same achievements, converted to
  // percentages, feed Engine 4 for Performance Band completion (feeding the Progress Arc tab).

  async getIndicatorAchievements(curriculumId) {
    const groups = await this.getPopulatedIndicators(curriculumId);
    const achievements = await IndicatorAchievementModel.findByCurriculumId(curriculumId);
    const byIndicatorId = new Map(achievements.map((a) => [a.indicatorId, a]));
    return groups.flatMap((g) =>
      g.indicators.map((ind) => ({
        competencyId:   g.competencyId,
        competencyName: g.competencyName,
        indicatorId:    ind.id,
        indicatorName:  ind.name,
        marksPossible:  ind.marksPossible,
        marksEarned:    byIndicatorId.get(ind.id)?.marksEarned ?? 0,
      }))
    );
  },

  async setIndicatorAchievement(curriculumId, indicatorId, competencyId, marksEarned) {
    if (!(await CurriculumCompetencyLinkModel.findOne(curriculumId, competencyId))) {
      const err = new Error("This curriculum hasn't adopted that competency yet");
      err.statusCode = 404;
      throw err;
    }
    const comp = await CompetencyModel.findById(competencyId);
    if (!comp || !(comp.indicators || []).some((i) => i.id === indicatorId)) {
      const err = new Error("Indicator not found on that competency");
      err.statusCode = 404;
      throw err;
    }
    return IndicatorAchievementModel.upsert(curriculumId, competencyId, indicatorId, marksEarned);
  },

  // Shared by getCompetencyScores (curriculum-wide manual preview) and getLearnerCompetencyScores
  // (real per-learner) — a competency's score is simply the % of its indicators' possible marks
  // earned, classified into this curriculum's Progress Level + Performance Band (Engine 3). No
  // separate evidence-to-competency mapping step is needed: an indicator belongs to exactly one
  // competency (it's nested under one in the global catalog), and which indicators an assessment
  // counts toward is already fixed at assessment-authoring time via indicatorMarks tagging — that
  // tagging IS the competency mapping. `indicatorRows` is either getIndicatorAchievements' shared
  // manual values (preview) or a real learner's getLearnerIndicatorProgress (live).
  async _competencyScoresFromIndicatorMarks(curriculumId, indicatorRows) {
    const competencies     = await this.getCurriculumCompetencies(curriculumId);
    const allBands = await PerformanceBandModel.findByCurriculum(curriculumId);
    const performanceBands = allBands.filter((b) => !b.learningAreaId);
    const progressLevels   = await ProgressLevelModel.findByCurriculumId(curriculumId);

    const byCompetency = new Map();
    indicatorRows.forEach(({ competencyId, marksEarned, marksPossible }) => {
      if (!competencyId) return;
      const cur = byCompetency.get(competencyId) || { marksEarned: 0, marksPossible: 0 };
      cur.marksEarned   += marksEarned || 0;
      cur.marksPossible += marksPossible || 0;
      byCompetency.set(competencyId, cur);
    });

    // Only competencies with at least one attempted indicator get a score — the rest simply
    // aren't in the returned array (the frontend shows "Not yet scored" for those), rather than a
    // misleading 0%.
    const competencyScores = competencies
      .filter((c) => byCompetency.has(c.id))
      .map((c) => {
        const { marksEarned, marksPossible } = byCompetency.get(c.id);
        const score = marksPossible > 0 ? Math.min(100, Math.round((marksEarned / marksPossible) * 100 * 10) / 10) : 0;
        return { competencyId: c.id, name: c.name, score };
      });

    return runProgressArcEngine(competencyScores, progressLevels, performanceBands);
  },

  // Curriculum-admin preview — every learner would see the same number from this one, since
  // "earned" comes from the shared manually-set IndicatorAchievementModel store rather than any
  // real learner's grading. See getLearnerCompetencyScores for the real per-learner version.
  async getCompetencyScores(curriculumId) {
    return this._competencyScoresFromIndicatorMarks(curriculumId, await this.getIndicatorAchievements(curriculumId));
  },

  // Real per-learner competency score — the number this learner should actually see on their
  // profile: their own graded work (AssessmentSubmissionService.getLearnerIndicatorProgress, the
  // same live source feeding the Competencies tab's flat indicator view), aggregated per
  // competency and classified via Engine 3, instead of the shared manual preview value.
  async getLearnerCompetencyScores(curriculumId, learnerId) {
    // Required lazily — see the note near the top of this file on why (circular require with
    // assessment-submission.service.js, which requires this file back for diagnostic placement).
    const AssessmentSubmissionService = require("../../assessments/submissions/assessment-submission.service");
    const rows = await AssessmentSubmissionService.getLearnerIndicatorProgress(learnerId, curriculumId);
    return this._competencyScoresFromIndicatorMarks(curriculumId, rows);
  },

  // Same pipeline as getLearnerCompetencyScores, narrowed to one specific set of assessments —
  // used by a course report, where "competency standing" should reflect the work that report
  // actually covers, not everything the learner has ever been graded on curriculum-wide. Only
  // counts assessments whose own report has been published to the learner, matching the
  // indicator breakdown shown alongside it (see getLearnerIndicatorProgressForAssessments).
  async getLearnerCompetencyScoresForAssessments(curriculumId, learnerId, assessmentIds) {
    const AssessmentSubmissionService = require("../../assessments/submissions/assessment-submission.service");
    const rows = await AssessmentSubmissionService.getLearnerIndicatorProgressForAssessments(learnerId, assessmentIds);
    return this._competencyScoresFromIndicatorMarks(curriculumId, rows);
  },

  // Live-data sibling of calculateIndicatorProgress — driven by what's actually persisted
  // instead of requiring the caller to construct the whole indicatorAchievements payload. This
  // is the curriculum-admin preview (shared manual store) — see getLearnerBandProgress for the
  // real per-learner version.
  async getBandProgress(curriculumId) {
    const achievements = await this.getIndicatorAchievements(curriculumId);
    const indicatorAchievements = achievements.map((a) => ({
      competencyId: a.competencyId,
      indicatorId:  a.indicatorId,
      percent:      a.marksPossible > 0 ? Math.min(100, (a.marksEarned / a.marksPossible) * 100) : 0,
    }));
    return this.calculateIndicatorProgress(curriculumId, indicatorAchievements);
  },

  // Real per-learner sibling of getBandProgress — indicatorAchievements built from this
  // learner's own accumulating progress (already computed with a `percent` per indicator) rather
  // than the shared curriculum-wide manual store.
  async getLearnerBandProgress(curriculumId, learnerId) {
    const AssessmentSubmissionService = require("../../assessments/submissions/assessment-submission.service");
    // Scoped to this curriculum, matching getLearnerCompetencyScores above — omitting curriculumId
    // here (as this used to) pulled in a multi-hub/multi-curriculum learner's indicator progress
    // from every curriculum they've ever been graded under, not just the one being viewed.
    const progress = await AssessmentSubmissionService.getLearnerIndicatorProgress(learnerId, curriculumId);
    const indicatorAchievements = progress.map((p) => ({
      competencyId: p.competencyId,
      indicatorId:  p.indicatorId,
      percent:      p.percent,
    }));
    return this.calculateIndicatorProgress(curriculumId, indicatorAchievements);
  },

  // Real cross-learner replacement for the old manual-entry preview above (IndicatorAchievementModel
  // has no UI anywhere to populate it — see getCompetencyScores). Averages every participating
  // learner's own getLearnerCompetencyScores by competencyId, then re-derives level/band from the
  // averaged score via the same runProgressArcEngine used everywhere else. "Participating" means
  // any learner with a graded submission against this curriculum's attached assessments — same
  // signal _evidenceTypeScoresFromEarnedMap already uses for "possible" marks.
  async getCurriculumWideCompetencyScores(curriculumId) {
    const AssessmentSubmissionModel = require("../../assessments/submissions/assessment-submission.model");
    const attachedIds = await this.getAttachedAssessmentIds(curriculumId);
    const assessmentIds = new Set(attachedIds);
    const graded = await AssessmentSubmissionModel.findAll({ status: "graded" });
    const learnerIds = [...new Set(
      graded.filter((s) => assessmentIds.has(s.assessmentId)).map((s) => s.learnerId)
    )];
    if (learnerIds.length === 0) return [];

    const sums = {}, counts = {}, names = {};
    for (const learnerId of learnerIds) {
      const scores = await this.getLearnerCompetencyScores(curriculumId, learnerId);
      scores.forEach((cs) => {
        sums[cs.competencyId]   = (sums[cs.competencyId]   || 0) + cs.score;
        counts[cs.competencyId] = (counts[cs.competencyId] || 0) + 1;
        names[cs.competencyId]  = cs.name;
      });
    }
    const averaged = Object.keys(sums).map((id) => ({
      competencyId: id, name: names[id], score: Math.round((sums[id] / counts[id]) * 10) / 10,
    }));

    const allBands = await PerformanceBandModel.findByCurriculum(curriculumId);
    const performanceBands = allBands.filter((b) => !b.learningAreaId);
    const progressLevels   = await ProgressLevelModel.findByCurriculumId(curriculumId);
    return runProgressArcEngine(averaged, progressLevels, performanceBands);
  },

  // Same cross-learner averaging as above, for Engine 4's band-completion % (getBandProgress).
  async getCurriculumWideBandProgress(curriculumId) {
    const AssessmentSubmissionModel = require("../../assessments/submissions/assessment-submission.model");
    const attachedIds = await this.getAttachedAssessmentIds(curriculumId);
    const assessmentIds = new Set(attachedIds);
    const graded = await AssessmentSubmissionModel.findAll({ status: "graded" });
    const learnerIds = [...new Set(
      graded.filter((s) => assessmentIds.has(s.assessmentId)).map((s) => s.learnerId)
    )];
    if (learnerIds.length === 0) return [];

    const sums = {}, counts = {}, meta = {};
    for (const learnerId of learnerIds) {
      const progress = await this.getLearnerBandProgress(curriculumId, learnerId);
      progress.forEach((bp) => {
        sums[bp.bandId]   = (sums[bp.bandId]   || 0) + bp.completion;
        counts[bp.bandId] = (counts[bp.bandId] || 0) + 1;
        meta[bp.bandId]   = { name: bp.name, advancementThreshold: bp.advancementThreshold };
      });
    }
    return Object.keys(sums).map((bandId) => {
      const completion = Math.round((sums[bandId] / counts[bandId]) * 10) / 10;
      return {
        bandId, name: meta[bandId].name, completion,
        advancementThreshold: meta[bandId].advancementThreshold,
        thresholdMet: completion >= meta[bandId].advancementThreshold,
      };
    });
  },

  async deleteEvidenceType(curriculumId, id) {
    const item = await EvidenceTypeModel.findById(id);
    if (!item || item.curriculumId !== curriculumId) {
      const err = new Error("Evidence type not found");
      err.statusCode = 404;
      throw err;
    }
    await EvidenceTypeModel.delete(id);
    // Remove this evidence type from all assessment type scoring configs
    const types = await AssessmentTypeModel.findByCurriculumId(curriculumId);
    await Promise.all(types.map((at) => {
      const filtered = (at.evidenceWeights || []).filter((w) => w.evidenceTypeId !== id);
      if (filtered.length !== (at.evidenceWeights || []).length) {
        return AssessmentTypeModel.update(at.id, { evidenceWeights: filtered });
      }
      return null;
    }));
  },

  /* ── Learning Journey ─────────────────────────────────────────────────
   * A learner's placement timeline, per Learning Area: where they started, every time
   * they've advanced, and wherever they currently stand. Nothing is persisted until a
   * placement is actually made — until then, a default is computed on the fly (Developmental
   * Stage's assignment for that area, falling back to the first course in its sequence). */

  // One entry per Learning Area in this curriculum — either the learner's real journey
  // record, or (if they've never been placed) a computed default that isn't saved until
  // placeLearner is called.
  async getLearningJourney(curriculumId, learnerId) {
    // Stage placement lives on the hub-enrollment link, not the learner record (a learner
    // enrolled at several hubs can be running a different curriculum at each) — find the one
    // link whose class resolves to THIS curriculum. See maybeAutoIssueDiagnostic's comment in
    // learner.service.js for why.
    const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
    let link = null;
    for (const l of links) {
      if (!l.classId) continue;
      const cls = await ClassModel.findById(l.classId);
      if (cls?.curriculumId === curriculumId) { link = l; break; }
    }
    const stage = link?.currentStageId ? await AgeCategoryModel.findById(link.currentStageId) : null;
    const areas = await LearningAreaModel.findByCurriculumId(curriculumId);

    return Promise.all(areas.map(async (area) => {
      const journey = await LearnerJourneyModel.findOne(learnerId, area.id);
      if (journey) {
        return {
          learningAreaId: area.id,
          learningAreaName: area.name,
          currentCourseId: journey.currentCourseId,
          history: journey.history,
          isDefault: false,
        };
      }

      const sequence = [...(area.courseSequence || [])].sort((a, b) => a.order - b.order);
      const stageDefault = stage ? sequence.find((s) => (s.defaultForStages || []).includes(stage.id)) : null;
      const defaultCourseId = stageDefault?.courseId || sequence[0]?.courseId || null;

      return {
        learningAreaId: area.id,
        learningAreaName: area.name,
        currentCourseId: defaultCourseId,
        history: [],
        isDefault: true,
      };
    }));
  },

  // Records a placement/advancement for one learner in one Learning Area — always appends
  // to history rather than overwriting it.
  async placeLearner(curriculumId, learnerId, learningAreaId, data) {
    const area = await LearningAreaModel.findById(learningAreaId);
    if (!area || area.curriculumId !== curriculumId) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    const learner = await LearnerModel.findById(learnerId);
    if (!learner) {
      const err = new Error("Learner not found");
      err.statusCode = 404;
      throw err;
    }
    return LearnerJourneyModel.place(learnerId, curriculumId, learningAreaId, data.courseId, data.reason, data.assessmentId);
  },

  // Given a diagnostic score, which course in this Learning Area's ladder (its Performance
  // Bands with learningAreaId+courseId set) the learner has earned. Walks bands by score
  // range and takes the highest one cleared; if none are cleared, falls back to the lowest
  // (a "prerequisite" placement rather than leaving the learner unplaced).
  async resolvePlacementFromScore(curriculumId, learningAreaId, score) {
    const bands = await PerformanceBandModel.findByLearningArea(curriculumId, learningAreaId);
    if (bands.length === 0) return null;
    const cleared = bands.filter((b) => score >= b.minScore);
    const matched = cleared.length > 0 ? cleared[cleared.length - 1] : bands[0];
    return matched.courseId;
  },

  // Ongoing (formative/summative) coursework can also move a learner forward: if this score
  // clears a placement threshold beyond wherever they currently stand, advance them there.
  // Never moves a learner backward — a dip in an ordinary assessment shouldn't undo a
  // placement; only a fresh diagnostic (resolvePlacementFromScore, above) does that.
  async checkAdvancement(curriculumId, learnerId, learningAreaId, score, assessmentId = null) {
    const bands = await PerformanceBandModel.findByLearningArea(curriculumId, learningAreaId);
    if (bands.length === 0) return null;

    const resolvedCourseId = await this.resolvePlacementFromScore(curriculumId, learningAreaId, score);
    if (!resolvedCourseId) return null;

    const journey = await LearnerJourneyModel.findOne(learnerId, learningAreaId);
    const currentIdx  = bands.findIndex((b) => b.courseId === journey?.currentCourseId);
    const resolvedIdx = bands.findIndex((b) => b.courseId === resolvedCourseId);
    if (resolvedIdx <= currentIdx) return null;

    return this.placeLearner(curriculumId, learnerId, learningAreaId, {
      courseId: resolvedCourseId, reason: "advanced", assessmentId,
    });
  },

  // Bridges a graded standalone diagnostic (see assessment-submission.service.js's
  // maybePlaceFromDiagnostic) into this learner's placement identity: the age category the
  // diagnostic was issued for becomes their confirmed Developmental Stage, and the score
  // resolves their curriculum-wide Performance Band — the same "stage x band" identity the
  // Identity Matrix preview describes, now persisted for the first time on a real learner.
  // Mirrors calculateScore's own band match (strict minScore/maxScore range) rather than
  // resolvePlacementFromScore's "highest cleared" rule, since that rule is specific to a
  // Learning Area's course ladder. `hubId` is the enrollment this diagnostic was issued for
  // (see issueDiagnostic) — placement is written onto that hub's link, not the learner record,
  // so a learner enrolled at several hubs keeps a separate placement at each.
  async placeLearnerFromDiagnostic(learnerId, hubId, ageCategoryId, scorePercent) {
    const category = await AgeCategoryModel.findById(ageCategoryId);
    if (!category) return null;
    const allBands = await PerformanceBandModel.findByCurriculum(category.curriculumId);
    const bands = allBands.filter((b) => !b.learningAreaId);
    const band = [...bands]
      .sort((a, b) => a.minScore - b.minScore)
      .find((b) => scorePercent >= b.minScore && scorePercent <= b.maxScore) || null;
    const link = await LearnerHubLinkModel.findOne(learnerId, hubId);
    if (link) await LearnerHubLinkModel.update(link.id, { currentStageId: ageCategoryId, currentBandId: band?.id ?? null });
    return { stageId: ageCategoryId, band };
  },

  // Bridges a graded standalone Learning-Area diagnostic (see assessment-submission.service.js's
  // maybePlaceFromDiagnostic) into that area's own Learning Journey: the score resolves a
  // starting course via resolvePlacementFromScore — the same "highest cleared threshold" rule
  // checkAdvancement uses for ongoing coursework — and always places the learner there, even if
  // that's their current or a "lower" course. Unlike checkAdvancement, a first diagnostic isn't
  // an advancement to guard against moving backward from; it's establishing the starting point.
  async placeLearnerFromLearningAreaDiagnostic(learnerId, learningAreaId, scorePercent, assessmentId = null) {
    const area = await LearningAreaModel.findById(learningAreaId);
    if (!area) return null;
    const courseId = await this.resolvePlacementFromScore(area.curriculumId, learningAreaId, scorePercent);
    if (!courseId) return null;
    return this.placeLearner(area.curriculumId, learnerId, learningAreaId, { courseId, reason: "diagnostic", assessmentId });
  },

};

module.exports = CompetencyService;
