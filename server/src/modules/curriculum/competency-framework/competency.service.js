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
const AssessmentModel        = require("./assessment.model");
const AssessmentTypeModel    = require("./assessment-type.model");
const EvidenceTypeModel      = require("./evidence-type.model");
const PerformanceBandModel   = require("./performance-band.model");
const { runAssessmentEngine, runCompetencyEngine, runProgressArcEngine, runIndicatorProgressEngine, combineAssessmentTypeScores } = require("./scoring-engines");
const IndicatorAchievementModel = require("./indicator-achievement.model");
const SessionModel                   = require("../../courses/session.model");
const { getSessionAssessmentIds } = require("../../courses/sessionAssessment.utils");
const CourseCurriculumLinkModel      = require("../../courses/course-curriculum-link.model");
const BuilderAssessmentModel         = require("../../assessments/assessment.model");
const AssessmentCompetencyLinkModel  = require("../../assessments/assessment-competency-link.model");
const CurriculumVersionModel         = require("../versions/curriculum-versions.model");
const LearnerJourneyModel            = require("./learner-journey.model");
const LearnerModel                   = require("../../learners/learner.model");

// A Learning Area's `courses` field stores course ids only — reject anything
// that doesn't resolve to a real course so a dummy id can never sneak in.
function assertCoursesExist(courseIds) {
  if (!courseIds) return;
  const missing = courseIds.filter((id) => !CourseModel.findById(id));
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

  getCurriculumCompetencies(curriculumId) {
    const links = CurriculumCompetencyLinkModel.findByCurriculumId(curriculumId);
    const comps = CompetencyModel.findByIds(links.map((l) => l.competencyId));
    const linksByCompetencyId = new Map(links.map((l) => [l.competencyId, l]));
    return comps.map((c) => {
      const link = linksByCompetencyId.get(c.id);
      return {
        ...c,
        minimumThreshold: link?.minimumThreshold ?? 60,
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
    IndicatorAchievementModel.deleteByLink(curriculumId, competencyId);
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
    const existing = CurriculumCompetencyIndicatorModel.findByLink(curriculumId, competencyId);
    if (existing.length > 0) return existing;

    // First time this curriculum's indicators are viewed for this competency — seed them
    // from the global competency's base indicators (Settings), split evenly to 100% as a
    // starting point. From here they're this curriculum's own copies: editing, reweighting,
    // adding, or deleting them never touches the global catalog.
    const globalIndicators = CompetencyModel.findById(competencyId)?.indicators || [];
    if (globalIndicators.length === 0) return [];

    const evenWeight = Math.floor(100 / globalIndicators.length);
    const remainder  = 100 - evenWeight * globalIndicators.length;
    return globalIndicators.map((gi, idx) =>
      CurriculumCompetencyIndicatorModel.create({
        curriculumId,
        competencyId,
        name:        gi.name,
        description: gi.description || "",
        weight:      evenWeight + (idx === globalIndicators.length - 1 ? remainder : 0),
      })
    );
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
    assertCoursesExist(data.courses);
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
    assertCoursesExist(data.courses);
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

  calculateScore(curriculumId, id, evidenceScores, learnerId = null) {
    const assessmentType = AssessmentTypeModel.findById(id);
    if (!assessmentType || assessmentType.curriculumId !== curriculumId) {
      const err = new Error("Assessment type not found");
      err.statusCode = 404;
      throw err;
    }

    const evidenceTypes    = EvidenceTypeModel.findByCurriculumId(curriculumId);
    const competencies     = this.getCurriculumCompetencies(curriculumId);
    // Learning-Area-scoped bands (Learning Journey's course ladders) share this same model
    // but shouldn't count toward the curriculum-wide Progress Arc band below.
    const performanceBands = PerformanceBandModel.findByCurriculum(curriculumId).filter((b) => !b.learningAreaId);
    const progressLevels   = ProgressLevelModel.findByCurriculumId(curriculumId);
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
        const courseId = this.resolvePlacementFromScore(curriculumId, assessmentType.learningAreaId, finalScore);
        if (courseId) {
          const journey = this.placeLearner(curriculumId, learnerId, assessmentType.learningAreaId, {
            courseId, reason: "diagnostic", assessmentId: id,
          });
          learningJourneyPlacement = { learningAreaId: assessmentType.learningAreaId, courseId, journey };
        }
      } else {
        const journey = this.checkAdvancement(curriculumId, learnerId, assessmentType.learningAreaId, finalScore, id);
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
  calculateIndicatorProgress(curriculumId, indicatorAchievements) {
    // Same Learning-Journey-band exclusion as calculateScore above — a scoped band has no
    // indicatorContributions of its own, so leaving it in would surface a bogus 100%-complete
    // entry (0 completion >= its 0 default threshold) alongside real Progress Arc bands.
    const performanceBands = PerformanceBandModel.findByCurriculum(curriculumId).filter((b) => !b.learningAreaId);
    return runIndicatorProgressEngine(indicatorAchievements, performanceBands);
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
  getAttachedAssessmentIds(curriculumId) {
    const courseIds = new Set(CourseCurriculumLinkModel.findByCurriculumId(curriculumId).map((l) => l.courseId));
    const currentVersion = CurriculumVersionModel.findAllByCurriculumId(curriculumId).find((v) => v.isCurrent);
    (currentVersion?.content || []).forEach((period) => {
      (period.classes || []).forEach((cls) => {
        (cls.courses || []).forEach((c) => courseIds.add(c.id));
      });
    });

    const assessmentIds = new Set();
    courseIds.forEach((courseId) => {
      SessionModel.findByCourseId(courseId).forEach((s) => {
        getSessionAssessmentIds(s).forEach((aid) => assessmentIds.add(aid));
      });
    });
    return assessmentIds;
  },

  getPopulatedIndicators(curriculumId) {
    const assessmentIds = this.getAttachedAssessmentIds(curriculumId);

    const usedIndicatorIds = new Set();
    const relevantCompetencyIds = new Set();
    // Marks possible per indicator — summed from `indicatorMarks` on items/rubric criteria
    // across every assessment attached to this curriculum. This is "marks possible," not
    // "marks earned" — there's no grading/submission data yet to compute actual achievement.
    const marksByIndicator = new Map();
    assessmentIds.forEach((aid) => {
      const assessment = BuilderAssessmentModel.findById(aid);
      if (!assessment) return;
      AssessmentCompetencyLinkModel.findByAssessmentId(aid).forEach((l) => relevantCompetencyIds.add(l.competencyId));

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
    });

    const groups = [];
    relevantCompetencyIds.forEach((competencyId) => {
      const comp = CompetencyModel.findById(competencyId);
      if (!comp) return;
      const indicators = (comp.indicators || [])
        .filter((ind) => usedIndicatorIds.has(ind.id))
        .map((ind) => ({ ...ind, marksPossible: marksByIndicator.get(ind.id) || 0 }));
      if (indicators.length === 0) return;
      groups.push({ competencyId, competencyName: comp.name, indicators });
    });

    return groups;
  },

  // ── Indicator Achievements — persisted marks-earned per indicator, joined against the live
  // marksPossible from getPopulatedIndicators above. Engine 5 aggregates these into
  // per-competency scores (feeding the Competencies tab); the same achievements, converted to
  // percentages, feed Engine 4 for Performance Band completion (feeding the Progress Arc tab).

  getIndicatorAchievements(curriculumId) {
    const groups = this.getPopulatedIndicators(curriculumId);
    const achievements = IndicatorAchievementModel.findByCurriculumId(curriculumId);
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

  setIndicatorAchievement(curriculumId, indicatorId, competencyId, marksEarned) {
    if (!CurriculumCompetencyLinkModel.findOne(curriculumId, competencyId)) {
      const err = new Error("This curriculum hasn't adopted that competency yet");
      err.statusCode = 404;
      throw err;
    }
    const comp = CompetencyModel.findById(competencyId);
    if (!comp || !(comp.indicators || []).some((i) => i.id === indicatorId)) {
      const err = new Error("Indicator not found on that competency");
      err.statusCode = 404;
      throw err;
    }
    return IndicatorAchievementModel.upsert(curriculumId, competencyId, indicatorId, marksEarned);
  },

  // Auto-computed score per Evidence Type (0-100) — pools indicator marks (earned vs. possible)
  // across every assessment attached to this curriculum whose type matches the Evidence Type's
  // category. `possible` is recomputed here filtered to that category (NOT the same as
  // getPopulatedIndicators' marksPossible, which pools every category together); `earned`
  // reuses the same curriculum-wide, category-agnostic achievement value per indicator that
  // also drives Progress Arc.
  getEvidenceTypeScores(curriculumId) {
    const evidenceTypes = EvidenceTypeModel.findByCurriculumId(curriculumId);
    const assessmentIds = this.getAttachedAssessmentIds(curriculumId);
    const earnedByIndicator = new Map(
      IndicatorAchievementModel.findByCurriculumId(curriculumId).map((a) => [a.indicatorId, a.marksEarned])
    );

    return evidenceTypes.map((et) => {
      if (!et.category) return { evidenceTypeId: et.id, score: 0 };

      let possible = 0;
      const seenIndicatorIds = new Set();
      assessmentIds.forEach((aid) => {
        const assessment = BuilderAssessmentModel.findById(aid);
        if (!assessment || assessment.type !== et.category) return;
        const scoredEntries = [...(assessment.items || []), ...(assessment.rubric || [])];
        scoredEntries.forEach((entry) => {
          (entry.indicatorMarks || []).forEach(({ indicatorId, marks }) => {
            possible += Number(marks) || 0;
            seenIndicatorIds.add(indicatorId);
          });
        });
      });

      const earned = [...seenIndicatorIds].reduce((sum, indId) => sum + (earnedByIndicator.get(indId) || 0), 0);
      const score = possible > 0 ? Math.min(100, Math.round((earned / possible) * 100 * 10) / 10) : 0;
      return { evidenceTypeId: et.id, score };
    });
  },

  // Real competency score pipeline: auto-computed Evidence Type scores (from real assessment
  // marks, above) run through the curriculum's actual Assessment Framework config — Engine 1 →
  // Engine 2 per Assessment Type, exactly as calculateScore does for a single type — combined
  // across every Assessment Type by its own typeWeight (Engine 5), then resolved to a Progress
  // Level + Performance Band (Engine 3). Score Evidence's weights stay manually configured;
  // only the evidence score itself is automatic.
  getCompetencyScores(curriculumId) {
    const evidenceScores   = this.getEvidenceTypeScores(curriculumId);
    const competencies     = this.getCurriculumCompetencies(curriculumId);
    const assessmentTypes  = AssessmentTypeModel.findByCurriculumId(curriculumId);
    const performanceBands = PerformanceBandModel.findByCurriculum(curriculumId).filter((b) => !b.learningAreaId);
    const progressLevels   = ProgressLevelModel.findByCurriculumId(curriculumId);

    const perTypeResults = assessmentTypes.map((at) => {
      const config = at.evidenceWeights || [];
      const { breakdown } = runAssessmentEngine(evidenceScores, config);
      const competencyScores = runCompetencyEngine(breakdown, config, competencies);
      return { typeWeight: at.typeWeight || 0, competencyScores };
    });

    const overall = combineAssessmentTypeScores(perTypeResults);
    return runProgressArcEngine(overall, progressLevels, performanceBands);
  },

  // Live-data sibling of calculateIndicatorProgress — driven by what's actually persisted
  // instead of requiring the caller to construct the whole indicatorAchievements payload.
  getBandProgress(curriculumId) {
    const achievements = this.getIndicatorAchievements(curriculumId);
    const indicatorAchievements = achievements.map((a) => ({
      competencyId: a.competencyId,
      indicatorId:  a.indicatorId,
      percent:      a.marksPossible > 0 ? Math.min(100, (a.marksEarned / a.marksPossible) * 100) : 0,
    }));
    return this.calculateIndicatorProgress(curriculumId, indicatorAchievements);
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

  /* ── Learning Journey ─────────────────────────────────────────────────
   * A learner's placement timeline, per Learning Area: where they started, every time
   * they've advanced, and wherever they currently stand. Nothing is persisted until a
   * placement is actually made — until then, a default is computed on the fly (Developmental
   * Stage's assignment for that area, falling back to the first course in its sequence). */

  // One entry per Learning Area in this curriculum — either the learner's real journey
  // record, or (if they've never been placed) a computed default that isn't saved until
  // placeLearner is called.
  getLearningJourney(curriculumId, learnerId) {
    const learner = LearnerModel.findById(learnerId);
    const stage = learner?.currentStageId ? AgeCategoryModel.findById(learner.currentStageId) : null;
    const areas = LearningAreaModel.findByCurriculumId(curriculumId);

    return areas.map((area) => {
      const journey = LearnerJourneyModel.findOne(learnerId, area.id);
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
    });
  },

  // Records a placement/advancement for one learner in one Learning Area — always appends
  // to history rather than overwriting it.
  placeLearner(curriculumId, learnerId, learningAreaId, data) {
    const area = LearningAreaModel.findById(learningAreaId);
    if (!area || area.curriculumId !== curriculumId) {
      const err = new Error("Learning area not found");
      err.statusCode = 404;
      throw err;
    }
    const learner = LearnerModel.findById(learnerId);
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
  resolvePlacementFromScore(curriculumId, learningAreaId, score) {
    const bands = PerformanceBandModel.findByLearningArea(curriculumId, learningAreaId);
    if (bands.length === 0) return null;
    const cleared = bands.filter((b) => score >= b.minScore);
    const matched = cleared.length > 0 ? cleared[cleared.length - 1] : bands[0];
    return matched.courseId;
  },

  // Ongoing (formative/summative) coursework can also move a learner forward: if this score
  // clears a placement threshold beyond wherever they currently stand, advance them there.
  // Never moves a learner backward — a dip in an ordinary assessment shouldn't undo a
  // placement; only a fresh diagnostic (resolvePlacementFromScore, above) does that.
  checkAdvancement(curriculumId, learnerId, learningAreaId, score, assessmentId = null) {
    const bands = PerformanceBandModel.findByLearningArea(curriculumId, learningAreaId);
    if (bands.length === 0) return null;

    const resolvedCourseId = this.resolvePlacementFromScore(curriculumId, learningAreaId, score);
    if (!resolvedCourseId) return null;

    const journey = LearnerJourneyModel.findOne(learnerId, learningAreaId);
    const currentIdx  = bands.findIndex((b) => b.courseId === journey?.currentCourseId);
    const resolvedIdx = bands.findIndex((b) => b.courseId === resolvedCourseId);
    if (resolvedIdx <= currentIdx) return null;

    return this.placeLearner(curriculumId, learnerId, learningAreaId, {
      courseId: resolvedCourseId, reason: "advanced", assessmentId,
    });
  },

};

module.exports = CompetencyService;
