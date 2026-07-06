const { z } = require("zod");
const { ASSESSMENT_TYPES } = require("../assessments/assessment.validation");
const {
  STRUCTURE_MODES, ITEM_KINDS, OBSERVATION_ITEM_KINDS, TASK_TYPES, SUBMISSION_ITEM_KINDS,
} = require("./builder.constants");

const DEFAULT_RATING_SCALE = ["Not Yet", "Developing", "Proficient"];

const sectionSchema = z.object({
  id:    z.string().min(1),
  name:  z.string().min(1, "Section name is required").max(150),
  order: z.number().optional().default(0),
});

// Mirrors the live assessment's item shape but without a persisted "id" requirement —
// ids are assigned fresh each time a template is applied. `id` here is optional and only
// used by the builder UI to key/select items while editing.
const templateItemSchema = z.object({
  id:            z.string().optional(),
  question:      z.string().min(1, "Question text is required").max(5000),
  kind:          z.enum(ITEM_KINDS, { errorMap: () => ({ message: "Select a valid item kind" }) }),
  sectionId:     z.string().optional().nullable().default(null),
  points:        z.number().min(0).optional().default(1),
  options:       z.array(z.string().min(1)).optional().default([]),
  correctAnswer: z.string().optional().default(""),
  pairs:         z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional().default([]),
  blanks:        z.array(z.string().min(1)).optional().default([]),
  sequence:      z.array(z.string().min(1)).optional().default([]),
  acceptedFileTypes: z.array(z.string().min(1)).optional().default([]),
  // Assignment/Project task fields
  taskType:      z.enum(TASK_TYPES).optional().nullable().default(null),
  submissionKinds: z.array(z.enum(SUBMISSION_ITEM_KINDS)).optional().default([]),
})
  .refine((d) => !["mcqSingle", "mcqMultiple"].includes(d.kind) || d.options.length >= 2, { message: "Add at least 2 options", path: ["options"] })
  .refine((d) => d.kind !== "matching" || d.pairs.length >= 2, { message: "Add at least 2 pairs", path: ["pairs"] })
  .refine((d) => d.kind !== "fillBlank" || d.blanks.length >= 1, { message: "Add at least 1 blank answer", path: ["blanks"] })
  .refine((d) => d.kind !== "ordering" || d.sequence.length >= 2, { message: "Add at least 2 steps", path: ["sequence"] });

const templateRubricCriterionSchema = z.object({
  criterion:   z.string().min(1, "Criterion name is required").max(200),
  description: z.string().max(5000).optional().default(""),
  points:      z.number().min(0).optional().default(0),
  sectionId:   z.string().optional().nullable().default(null),
});

// Teacher Observation content — a checklist of observable items. `kind` defaults to "rating" so
// existing seeded data (authored before this field existed) keeps validating unchanged.
const templateIndicatorSchema = z.object({
  id:          z.string().optional(),
  text:        z.string().min(1, "Indicator text is required").max(300),
  kind:        z.enum(OBSERVATION_ITEM_KINDS).optional().default("rating"),
  ratingScale: z.array(z.string().min(1)).min(2).optional().default(DEFAULT_RATING_SCALE),
  sectionId:   z.string().optional().nullable().default(null),
});

const deliverableSchema = z.object({
  id:              z.string().optional(),
  name:            z.string().min(1, "Deliverable name is required").max(200),
  description:     z.string().max(2000).optional().default(""),
  submissionKinds: z.array(z.enum(SUBMISSION_ITEM_KINDS)).optional().default([]),
  sectionId:       z.string().optional().nullable().default(null),
});

const milestoneSchema = z.object({
  id:          z.string().optional(),
  name:        z.string().min(1, "Milestone name is required").max(200),
  description: z.string().max(2000).optional().default(""),
  order:       z.number().optional().default(0),
});

const createTemplateSchema = z.object({
  name:          z.string().min(1, "Template name is required").max(150),
  type:          z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: "Select a valid assessment type" }) }),
  description:   z.string().max(1000).optional().default(""),
  instructions:  z.string().max(5000).optional().default(""),
  structureType: z.enum(STRUCTURE_MODES).optional().default("mixed"),
  overview:      z.string().max(3000).optional().default(""),
  sections:      z.array(sectionSchema).optional().default([]),
  items:         z.array(templateItemSchema).optional().default([]),
  rubric:        z.array(templateRubricCriterionSchema).optional().default([]),
  indicators:    z.array(templateIndicatorSchema).optional().default([]),
  deliverables:  z.array(deliverableSchema).optional().default([]),
  milestones:    z.array(milestoneSchema).optional().default([]),
});

const updateTemplateSchema = createTemplateSchema.partial();

module.exports = {
  createTemplateSchema,
  updateTemplateSchema,
};
