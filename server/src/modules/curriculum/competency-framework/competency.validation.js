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

const createLearningAreaSchema = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().default("#25476a"),
  courses:     z.array(z.string().min(1).max(150)).optional().default([]),
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

const createAgeCategorySchema = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  ageRange:    z.string().max(50).optional().default(""),
  description: z.string().max(500).optional().default(""),
});

const updateAgeCategorySchema = createAgeCategorySchema.partial();

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
});

const updateAssessmentTypeSchema = createAssessmentTypeSchema.partial();

const competencyMappingSchema = z.object({
  competencyId: z.string().min(1),
  weight:       z.number().min(0).max(100),
});

const evidenceWeightSchema = z.object({
  evidenceTypeId:     z.string().min(1),
  contribution:       z.number().min(0).max(100),
  minRequirement:     z.number().min(0).max(100).nullable().optional().default(null),
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
  minRequirement:      z.number().min(0).max(100).optional().default(0),
});

const updateEvidenceTypeSchema = createEvidenceTypeSchema.partial();

// What % of a specific competency's 100% this band assigns to one of its indicators.
// Meant to sum to 100% across all of that competency's indicators within this band —
// not enforced server-side (a band can be saved mid-configuration), the client shows
// the running total as a hint.
const bandIndicatorContributionSchema = z.object({
  competencyId: z.string().min(1),
  indicatorId:  z.string().min(1),
  percentage:   z.number().min(0).max(100),
});

const createPerformanceBandSchema = z.object({
  name:          z.string().min(1, "Name is required").max(100),
  description:   z.string().max(1000).optional().default(""),
  criteria:      z.array(z.string().min(1).max(500)).optional().default([]),
  minScore:      z.number().min(0).max(100).optional().default(0),
  maxScore:      z.number().min(0).max(100).optional().default(100),
  // Competencies (from the ones this curriculum has adopted) that this band draws on.
  competencyIds:          z.array(z.string().min(1)).optional().default([]),
  indicatorContributions: z.array(bandIndicatorContributionSchema).optional().default([]),
  // Minimum % of this band's indicator contributions a learner must clear to be
  // considered as having progressed past this band to the next one in order.
  advancementThreshold:   z.number().min(0).max(100).optional().default(0),
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
};
