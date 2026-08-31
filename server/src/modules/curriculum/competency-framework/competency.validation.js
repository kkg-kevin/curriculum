const { z } = require("zod");

const linkCompetencySchema = z.object({
  competencyId: z.string().min(1, "competencyId is required"),
});

// Threshold is how THIS curriculum evaluates an adopted competency.
const updateCompetencyLinkSchema = z.object({
  minimumThreshold: z.number().min(0).max(100).optional(),
});

const createIndicatorSchema = z.object({
  name:        z.string().min(1, "Name is required").max(150),
  description: z.string().max(300).optional().default(""),
  weight:      z.number().min(0).max(100).optional().default(0),
});

const updateIndicatorSchema = createIndicatorSchema.partial();

// This Learning Area's courses, in the order a learner progresses through them (e.g.
// Robotics 1 -> 2 -> 3 -> 4) — for Learning Journey. Additive alongside `courses` (which
// stays the plain "which courses belong here" list untouched by this); a courseId here
// should also appear in `courses`, but isn't required to — the service doesn't enforce it,
// same leniency as the rest of this file.
const learningAreaCourseSequenceEntrySchema = z.object({
  courseId: z.string().min(1),
  order:    z.number().int().min(1),
  // Developmental Stage ids that default a learner into this course when they have no
  // Learning Journey record yet — see CompetencyService.getLearningJourney's fallback.
  defaultForStages: z.array(z.string().min(1)).optional().default([]),
});

const ageRangeRefinement = (data) =>
  data.minAge == null || data.maxAge == null || data.maxAge >= data.minAge;
const ageRangeRefinementOptions = {
  message: "Maximum age must be greater than or equal to minimum age",
  path:    ["maxAge"],
};

// Kept as a plain (unrefined) object, same reason as ageCategoryFields below — Zod can't
// .partial() a schema that already has .refine() attached, so create/update each apply their
// own refine on top of these raw fields instead of one refining the other.
const learningAreaFields = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().default("#25476a"),
  // Course ids, not free-typed names — the service layer checks each id resolves
  // to a real course before saving.
  courses:     z.array(z.string().min(1)).optional().default([]),
  courseSequence: z.array(learningAreaCourseSequenceEntrySchema).optional().default([]),
  // The one assessment auto-issued to a learner once a class places them in front of one of
  // this area's courses — one diagnostic per area, same "single FK" pattern as AgeCategory's
  // diagnosticAssessmentId. Its graded score resolves a starting course via this area's
  // Placement Thresholds (Performance Bands with learningAreaId+courseId set) — see
  // CompetencyService.placeLearnerFromLearningAreaDiagnostic.
  diagnosticAssessmentId: z.string().optional().nullable().default(null),
  // Which learners this area's diagnostic even applies to, by age — same open-ended-range
  // shape as AgeCategory's minAge/maxAge. Both null (the default) means every age, which is
  // also today's behavior for every pre-existing area — see maybeAutoIssueLearningAreaDiagnostics
  // in learner.service.js for where this actually gates issuance.
  minAge:      z.number().int().min(0).max(120).nullable().optional().default(null),
  maxAge:      z.number().int().min(0).max(120).nullable().optional().default(null),
});

const createLearningAreaSchema = learningAreaFields.refine(ageRangeRefinement, ageRangeRefinementOptions);
const updateLearningAreaSchema = learningAreaFields.partial().refine(ageRangeRefinement, ageRangeRefinementOptions);

const importLearningAreaSchema = z.object({
  learningAreaId: z.string().min(1, "learningAreaId is required"),
});

const assignmentSchema = z.object({
  competencyId: z.string(),
  descriptor:   z.string().max(300).optional().default(""),
});

const rungSchema = z.object({
  id:          z.string(),
  label:       z.string().min(1).max(100),
  ageRange:    z.string().max(30).optional().default(""),
  order:       z.number().int().min(1),
  assignments: z.array(assignmentSchema).default([]),
});

const updateLadderSchema = z.object({
  rungs: z.array(rungSchema),
});

const ageCategoryFields = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  minAge:      z.number().int().min(0).max(120).nullable().optional().default(null),
  maxAge:      z.number().int().min(0).max(120).nullable().optional().default(null),
  // The one assessment auto-issued to a new learner once their age resolves to this stage —
  // one diagnostic per stage, same "single FK, not a whole module" pattern as
  // class.classTeacherId / curriculum.curriculumAdminId.
  diagnosticAssessmentId: z.string().optional().nullable().default(null),
});

const createAgeCategorySchema = ageCategoryFields.refine(ageRangeRefinement, ageRangeRefinementOptions);
const updateAgeCategorySchema = ageCategoryFields.partial().refine(ageRangeRefinement, ageRangeRefinementOptions);

const createProgressLevelSchema = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  minScore:    z.number().min(0).max(100).optional().default(0),
  maxScore:    z.number().min(0).max(100).optional().default(100),
});

const updateProgressLevelSchema = createProgressLevelSchema.partial();

const BEHAVIOR_TYPES = ["diagnostic", "formative", "summative"];

const createAssessmentTypeSchema = z.object({
  name:              z.string().min(1, "Name is required").max(150),
  description:       z.string().max(1000).optional().default(""),
  behaviorType:      z.enum(BEHAVIOR_TYPES, { errorMap: () => ({ message: "Behavior type must be diagnostic, formative, or summative" }) }),
  progressionWeight: z.number().min(0).max(1).optional().default(1.0),
});

const updateAssessmentTypeSchema = createAssessmentTypeSchema.partial();

const competencyMappingSchema = z.object({
  competencyId: z.string().min(1),
  weight:       z.number().min(0).max(100),
});

const evidenceWeightSchema = z.object({
  evidenceTypeId:     z.string().min(1),
  contribution:       z.number().min(0).max(100),
  competencyMappings: z.array(competencyMappingSchema).optional().default([]),
});

const updateScoringSchema = z.object({
  evidenceWeights: z.array(evidenceWeightSchema),
});

// Two-tier scoring: each type has its own weight (tier-2) and its own evidence weights (tier-1)
const assessmentTypeScoringSchema = z.object({
  id:              z.string().min(1),
  typeWeight:      z.number().min(0).max(100),
  evidenceWeights: z.array(evidenceWeightSchema),
});

// Tier-3: overall assessment score → competency contribution
const competencyWeightSchema = z.object({
  competencyId: z.string().min(1),
  weight:       z.number().min(0).max(100),
});

const updateGlobalScoringSchema = z.object({
  assessmentTypes:   z.array(assessmentTypeScoringSchema).min(1),
  competencyWeights: z.array(competencyWeightSchema).optional().default([]),
});

// Mirrors the real Assessment Builder's fixed type list (server/src/modules/assessments/assessment.validation.js)
// so a course-attached assessment can be auto-matched to the evidence type that scores it — a shared vocabulary
// instead of a free-text name match. Null means this evidence type has no builder-assessment equivalent.
const EVIDENCE_CATEGORIES = ["quiz", "exam", "project", "assignment", "observation"];

const createEvidenceTypeSchema = z.object({
  name:                z.string().min(1, "Name is required").max(150),
  description:         z.string().max(500).optional().default(""),
  category:            z.enum(EVIDENCE_CATEGORIES, { errorMap: () => ({ message: "Category must be one of: quiz, exam, project, assignment, observation" }) }).nullable().optional().default(null),
  defaultContribution: z.number().min(0).max(100).optional().default(0),
  // Count-based reference: "at least N items of this evidence type are expected" (e.g. minimum
  // quizzes to complete). Data capture only for now — not read by the scoring engine, since a
  // single evidence type can be reused across courses with different item counts.
  minItemCount:        z.number().int().min(0).optional().default(0),
});

const updateEvidenceTypeSchema = createEvidenceTypeSchema.partial();

// What % of this band's 100% one of its indicators is worth. When a band draws on more
// than one competency, every indicator across all of them shares that same 100% budget —
// meant to sum to 100% band-wide, not per competency. Not enforced server-side (a band
// can be saved mid-configuration); the client shows the running total as a hint.
const bandIndicatorContributionSchema = z.object({
  competencyId: z.string().min(1),
  indicatorId:  z.string().min(1),
  percentage:   z.number().min(0).max(100),
});

// A Progress-Arc-purpose band (learningAreaId null) now belongs to exactly one Developmental
// Stage — no more curriculum-wide fallback ladder. A Learning-Journey band (learningAreaId +
// courseId set) never has one; see the module-level comment in performance-band.model.js.
const bandStageRefinement = (data) => data.learningAreaId != null || data.ageCategoryId != null;
const bandStageRefinementOptions = {
  message: "ageCategoryId is required for a Progress-Arc-purpose band (no learningAreaId)",
  path:    ["ageCategoryId"],
};

// Kept as a plain (unrefined) object, same reason as learningAreaFields/ageCategoryFields above —
// Zod can't .partial() a schema that already has .refine() attached.
const performanceBandFields = z.object({
  name:          z.string().min(1, "Name is required").max(100),
  description:   z.string().max(1000).optional().default(""),
  minScore:      z.number().min(0).max(100).optional().default(0),
  maxScore:      z.number().min(0).max(100).optional().default(100),
  // Explicit position in the stage's ladder (Explorer=1, Builder=2, …) — the client sends this
  // on create so a band's name fixes its rank regardless of creation order. Omitted, the model
  // falls back to appending at the end of the stage's current ladder (its old behavior).
  order:         z.number().int().min(1).optional(),
  // Competencies (from the ones this curriculum has adopted) that this band draws on.
  competencyIds:          z.array(z.string().min(1)).optional().default([]),
  indicatorContributions: z.array(bandIndicatorContributionSchema).optional().default([]),
  // The advancement bar is a range. `advancementMin` is the lower end — a display-only "on
  // track / approaching" marker; it gates nothing. `advancementThreshold` is the upper end
  // (the MAX): the % of this band's indicator contributions a learner must clear to have
  // progressed past this band to the next one (see runIndicatorProgressEngine's thresholdMet).
  advancementMin:         z.number().min(0).max(100).optional().default(0),
  advancementThreshold:   z.number().min(0).max(100).optional().default(0),
  // Learning Journey reuses Performance Bands as a per-Learning-Area course ladder: when
  // both of these are set, this band represents one rung in that Learning Area's course
  // sequence (matched by score range via minScore/maxScore) rather than a Developmental
  // Stage's Progress Arc ladder. Left null, a band behaves exactly as it always has.
  learningAreaId:         z.string().nullable().optional().default(null),
  courseId:               z.string().nullable().optional().default(null),
  // Which Developmental Stage's own ladder this band belongs to — required (via the refine
  // below) unless this is a Learning-Journey band (learningAreaId set), which never gets one.
  ageCategoryId:          z.string().nullable().optional().default(null),
});

// min must not sit above max. Checked only when both are present and both > 0 — a 0 on either
// side means "that end not configured", and on a partial update one end may be absent entirely.
const bandAdvancementRangeRefinement = (data) => {
  const min = data.advancementMin;
  const max = data.advancementThreshold;
  if (min == null || max == null || min === 0 || max === 0) return true;
  return min <= max;
};
const bandAdvancementRangeOptions = {
  message: "The 'on track' minimum can't be higher than the advancement maximum",
  path:    ["advancementMin"],
};

const createPerformanceBandSchema = performanceBandFields
  .refine(bandStageRefinement, bandStageRefinementOptions)
  .refine(bandAdvancementRangeRefinement, bandAdvancementRangeOptions);
const updatePerformanceBandSchema = performanceBandFields.partial()
  .refine(bandStageRefinement, bandStageRefinementOptions)
  .refine(bandAdvancementRangeRefinement, bandAdvancementRangeOptions);

const reorderBandsSchema = z.object({
  ageCategoryId: z.string().nullable().optional().default(null),
  orderedIds:    z.array(z.string().min(1)),
});

const evidenceScoreSchema = z.object({
  evidenceTypeId: z.string().min(1),
  score:          z.number().min(0).max(100),
});

const calculateScoreSchema = z.object({
  evidenceScores: z.array(evidenceScoreSchema),
  // Which Developmental Stage's ladder to score against — required now that Performance Bands
  // are scoped per stage rather than one flat curriculum-wide ladder.
  ageCategoryId:  z.string().min(1, "ageCategoryId is required"),
});

const indicatorAchievementSchema = z.object({
  competencyId: z.string().min(1),
  indicatorId:  z.string().min(1),
  percent:      z.number().min(0).max(100),
});

const calculateIndicatorProgressSchema = z.object({
  ageCategoryId:         z.string().min(1, "ageCategoryId is required"),
  indicatorAchievements: z.array(indicatorAchievementSchema),
});

const setIndicatorAchievementSchema = z.object({
  competencyId: z.string().min(1),
  marksEarned:  z.number().min(0),
});

const REASON_TYPES = ["default", "diagnostic", "advanced", "manual"];

const placeLearnerSchema = z.object({
  courseId:     z.string().min(1, "courseId is required"),
  reason:       z.enum(REASON_TYPES).optional().default("manual"),
  assessmentId: z.string().nullable().optional().default(null),
});

module.exports = {
  linkCompetencySchema,
  updateCompetencyLinkSchema,
  createIndicatorSchema,
  updateIndicatorSchema,
  createLearningAreaSchema,
  updateLearningAreaSchema,
  importLearningAreaSchema,
  updateLadderSchema,
  createAgeCategorySchema,
  updateAgeCategorySchema,
  createProgressLevelSchema,
  updateProgressLevelSchema,
  createAssessmentTypeSchema,
  updateAssessmentTypeSchema,
  updateScoringSchema,
  updateGlobalScoringSchema,
  createEvidenceTypeSchema,
  updateEvidenceTypeSchema,
  EVIDENCE_CATEGORIES,
  createPerformanceBandSchema,
  updatePerformanceBandSchema,
  reorderBandsSchema,
  calculateScoreSchema,
  calculateIndicatorProgressSchema,
  setIndicatorAchievementSchema,
  placeLearnerSchema,
};
