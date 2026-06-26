const { z } = require("zod");

const createLearningAreaSchema = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().default("#25476a"),
});

const updateLearningAreaSchema = createLearningAreaSchema.partial();

const createCompetencySchema = z.object({
  name:             z.string().min(1, "Name is required").max(150),
  description:      z.string().max(500).optional().default(""),
  learningAreaId:   z.string().nullable().optional().default(null),
  minimumThreshold: z.number().min(0).max(100).optional().default(60),
});

const updateCompetencySchema = createCompetencySchema.partial();

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

// Global scoring: all three assessment types together must sum to 100%
const assessmentTypeScoringSchema = z.object({
  id:              z.string().min(1),
  evidenceWeights: z.array(evidenceWeightSchema),
});

const updateGlobalScoringSchema = z.object({
  assessmentTypes: z.array(assessmentTypeScoringSchema).min(1),
});

const createEvidenceTypeSchema = z.object({
  name:                z.string().min(1, "Name is required").max(150),
  description:         z.string().max(500).optional().default(""),
  defaultContribution: z.number().min(0).max(100).optional().default(0),
  minRequirement:      z.number().min(0).max(100).optional().default(0),
});

const updateEvidenceTypeSchema = createEvidenceTypeSchema.partial();

const createPerformanceBandSchema = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(1000).optional().default(""),
  criteria:    z.array(z.string().min(1).max(500)).optional().default([]),
  minScore:    z.number().min(0).max(100).optional().default(0),
  maxScore:    z.number().min(0).max(100).optional().default(100),
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
  createLearningAreaSchema,
  updateLearningAreaSchema,
  createCompetencySchema,
  updateCompetencySchema,
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
  createPerformanceBandSchema,
  updatePerformanceBandSchema,
  reorderBandsSchema,
  calculateScoreSchema,
};
