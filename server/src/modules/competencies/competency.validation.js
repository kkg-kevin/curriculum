const { z } = require("zod");

const createLearningAreaSchema = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().default("#25476a"),
});

const updateLearningAreaSchema = createLearningAreaSchema.partial();

const createCompetencySchema = z.object({
  name:           z.string().min(1, "Name is required").max(150),
  description:    z.string().max(500).optional().default(""),
  learningAreaId: z.string().nullable().optional().default(null),
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
});

const updateProgressLevelSchema = createProgressLevelSchema.partial();

const ASSESSMENT_TYPES = ["formative", "summative", "diagnostic", "project"];

const createAssessmentSchema = z.object({
  name:        z.string().min(1, "Name is required").max(150),
  type:        z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: "Invalid assessment type" }) }),
  description: z.string().max(1000).optional().default(""),
});

const updateAssessmentSchema = createAssessmentSchema.partial();

const createAssessmentTypeSchema = z.object({
  name:        z.string().min(1, "Name is required").max(150),
  description: z.string().max(1000).optional().default(""),
});

const updateAssessmentTypeSchema = createAssessmentTypeSchema.partial();

const evidenceWeightSchema = z.object({
  evidenceTypeId: z.string().min(1),
  weight:         z.number().min(0).max(100),
});

const updateScoringSchema = z.object({
  evidenceWeights: z.array(evidenceWeightSchema),
});

const createEvidenceTypeSchema = z.object({
  name:        z.string().min(1, "Name is required").max(150),
  description: z.string().max(500).optional().default(""),
});

const updateEvidenceTypeSchema = createEvidenceTypeSchema.partial();

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
  createEvidenceTypeSchema,
  updateEvidenceTypeSchema,
};
