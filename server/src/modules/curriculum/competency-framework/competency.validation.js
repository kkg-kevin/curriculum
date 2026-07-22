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

const createLearningAreaSchema = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().default("#25476a"),
  // Course ids, not free-typed names — the service layer checks each id resolves
  // to a real course before saving.
  courses:     z.array(z.string().min(1)).optional().default([]),
  courseSequence: z.array(learningAreaCourseSequenceEntrySchema).optional().default([]),
});

const updateLearningAreaSchema = createLearningAreaSchema.partial();

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
});

const ageRangeRefinement = (data) =>
  data.minAge == null || data.maxAge == null || data.maxAge >= data.minAge;
const ageRangeRefinementOptions = {
  message: "Maximum age must be greater than or equal to minimum age",
  path:    ["maxAge"],
};

const createAgeCategorySchema = ageCategoryFields.refine(ageRangeRefinement, ageRangeRefinementOptions);
const updateAgeCategorySchema = ageCategoryFields.partial().refine(ageRangeRefinement, ageRangeRefinementOptions);

const createProgressLevelSchema = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  minScore:    z.number().min(0).max(100).optional().default(0),
  maxScore:    z.number().min(0).max(100).optional().default(100),
});

const updateProgressLevelSchema = createProgressLevelSchema.partial();

const ASSESSMENT_TYPES = ["formative", "summative", "diagnostic", "project"];

const createAssessmentSchema = z.object({
  name:        z.string().min(1, "Name is required").max(150),
  type:        z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: "Invalid assessment type" }) }),
  description: z.string().max(1000).optional().default(""),
});

const updateAssessmentSchema = createAssessmentSchema.partial();

const BEHAVIOR_TYPES = ["diagnostic", "formative", "summative"];

const createAssessmentTypeSchema = z.object({
  name:              z.string().min(1, "Name is required").max(150),
  description:       z.string().max(1000).optional().default(""),
  behaviorType:      z.enum(BEHAVIOR_TYPES, { errorMap: () => ({ message: "Behavior type must be diagnostic, formative, or summative" }) }),
  progressionWeight: z.number().min(0).max(1).optional().default(1.0),
  // Which Learning Area a diagnostic assessment type places a learner into — only
  // meaningful when behaviorType is "diagnostic". Null means this type isn't tied to
  // Learning Journey placement.
  learningAreaId:    z.string().nullable().optional().default(null),
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

const createPerformanceBandSchema = z.object({
  name:          z.string().min(1, "Name is required").max(100),
  description:   z.string().max(1000).optional().default(""),
  minScore:      z.number().min(0).max(100).optional().default(0),
  maxScore:      z.number().min(0).max(100).optional().default(100),
  // Competencies (from the ones this curriculum has adopted) that this band draws on.
  competencyIds:          z.array(z.string().min(1)).optional().default([]),
  indicatorContributions: z.array(bandIndicatorContributionSchema).optional().default([]),
  // Minimum % of this band's indicator contributions a learner must clear to be
  // considered as having progressed past this band to the next one in order.
  advancementThreshold:   z.number().min(0).max(100).optional().default(0),
  // Learning Journey reuses Performance Bands as a per-Learning-Area course ladder: when
  // both of these are set, this band represents one rung in that Learning Area's course
  // sequence (matched by score range via minScore/maxScore) rather than a curriculum-wide
  // Progress Arc tier. Left null, a band behaves exactly as it always has.
  learningAreaId:         z.string().nullable().optional().default(null),
  courseId:               z.string().nullable().optional().default(null),
});

const updatePerformanceBandSchema = createPerformanceBandSchema.partial();

const reorderBandsSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

const evidenceScoreSchema = z.object({
  evidenceTypeId: z.string().min(1),
  score:          z.number().min(0).max(100),
});

const calculateScoreSchema = z.object({
  evidenceScores: z.array(evidenceScoreSchema),
  // Optional — when provided and this assessment type is a diagnostic tied to a Learning
  // Area, the resulting score also resolves and records a Learning Journey placement for
  // this learner.
  learnerId: z.string().nullable().optional().default(null),
});

const indicatorAchievementSchema = z.object({
  competencyId: z.string().min(1),
  indicatorId:  z.string().min(1),
  percent:      z.number().min(0).max(100),
});

const calculateIndicatorProgressSchema = z.object({
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
  createAssessmentSchema,
  updateAssessmentSchema,
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
