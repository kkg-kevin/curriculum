const { z } = require("zod");
const {
  STRUCTURE_MODES, ITEM_KINDS, OBSERVATION_ITEM_KINDS, TASK_TYPES, SUBMISSION_ITEM_KINDS,
} = require("./builder.constants");

const ASSESSMENT_TYPES = ["quiz", "exam", "project", "assignment", "observation"];
const DEFAULT_RATING_SCALE = ["Not Yet", "Developing", "Proficient"];
const DEFAULT_SURVEY_SCALE = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];

// Rich-text fields (authored via TipTap) store HTML — an empty editor still serializes
// to "<p></p>", so a plain length/min(1) check doesn't actually catch "nothing typed".
// Content only counts as present once tags are stripped, unless it's just an image.
function hasRichContent(html) {
  if (!html) return false;
  if (/<img[\s>]/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

const sectionSchema = z.object({
  id:    z.string().min(1),
  name:  z.string().min(1, "Section name is required").max(150),
  order: z.number().optional().default(0),
});

// Marks assigned to a specific competency indicator on a question/criterion — the entry's
// total is the sum of these once any are present (see computeEntryMarks in assessment.utils.js).
const indicatorMarkSchema = z.object({
  indicatorId: z.string().min(1),
  marks:       z.number().min(0),
});

// One checklist line in a question's grading rubric — e.g. "Did the student answer" (1pt).
// Only meaningful when the parent entry is tagged to exactly one indicatorMark: the Builder
// keeps that indicator's `marks` in sync with the sum of these (see ScoringCriteriaEditor in
// AssessmentBuilderPage.jsx), so nothing downstream needs to know this array exists — scoring
// still reads indicatorMarks/points exactly as before.
const scoringCriterionSchema = z.object({
  id:     z.string().optional(),
  label:  z.string().min(1, "Criterion is required").max(300),
  points: z.number().min(0).optional().default(0),
});

// `id` is optional — the Builder assigns a client-side id while editing; the server
// doesn't require one since items live embedded in the assessment document, not as
// independently-addressable rows.
const itemSchema = z.object({
  id:            z.string().optional(),
  question:      z.string().max(20000),
  kind:          z.enum(ITEM_KINDS, { errorMap: () => ({ message: "Select a valid item kind" }) }),
  sectionId:     z.string().optional().nullable().default(null),
  points:        z.number().min(0).optional().default(1),
  options:       z.array(z.string().min(1)).optional().default([]),
  correctAnswer: z.string().optional().default(""),
  pairs:         z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional().default([]),
  blanks:        z.array(z.string().min(1)).optional().default([]),
  sequence:      z.array(z.string().min(1)).optional().default([]),
  ratingScale:   z.array(z.string().min(1)).optional().default(DEFAULT_SURVEY_SCALE),
  acceptedFileTypes: z.array(z.string().min(1)).optional().default([]),
  // Assignment/Project task fields
  taskType:      z.enum(TASK_TYPES).optional().nullable().default(null),
  submissionKinds: z.array(z.enum(SUBMISSION_ITEM_KINDS)).optional().default([]),
  // Marks split across the competency indicator(s) this question assesses — indicatorId
  // points into a linked competency's nested `indicators` array (see
  // assessment-competency-link.model.js). Empty when the question isn't tagged to any
  // indicator, in which case `points` above is the question's total instead.
  indicatorMarks: z.array(indicatorMarkSchema).optional().default([]),
  // Grading rubric for this question — see scoringCriterionSchema above.
  scoringCriteria: z.array(scoringCriterionSchema).optional().default([]),
})
  .refine((d) => hasRichContent(d.question), { message: "Question text is required", path: ["question"] })
  .refine((d) => !["mcqSingle", "mcqMultiple"].includes(d.kind) || d.options.length >= 2, { message: "Add at least 2 options", path: ["options"] })
  .refine((d) => d.kind !== "matching" || d.pairs.length >= 2, { message: "Add at least 2 pairs", path: ["pairs"] })
  .refine((d) => d.kind !== "fillBlank" || d.blanks.length >= 1, { message: "Add at least 1 blank answer", path: ["blanks"] })
  .refine((d) => d.kind !== "ordering" || d.sequence.length >= 2, { message: "Add at least 2 steps", path: ["sequence"] })
  .refine((d) => d.kind !== "survey" || d.ratingScale.length >= 2, { message: "Add at least 2 scale points", path: ["ratingScale"] });

const rubricCriterionSchema = z.object({
  id:          z.string().optional(),
  criterion:   z.string().min(1, "Criterion name is required").max(200),
  description: z.string().max(5000).optional().default(""),
  points:      z.number().min(0).optional().default(0),
  sectionId:   z.string().optional().nullable().default(null),
  indicatorMarks: z.array(indicatorMarkSchema).optional().default([]),
  // Grading rubric for this criterion — see scoringCriterionSchema above.
  scoringCriteria: z.array(scoringCriterionSchema).optional().default([]),
});

// Teacher Observation content — a checklist of observable items. `kind` defaults to
// "rating" so legacy data authored before this field existed keeps validating unchanged.
// `points`/`indicatorMarks` mirror itemSchema/rubricCriterionSchema exactly — an observation
// indicator is scored the same way any other entry is (a flat total, optionally split across
// tagged competency indicators). `competencyIndicatorIds` is kept only so old records authored
// before indicatorMarks existed still parse; the builder no longer writes it.
const indicatorSchema = z.object({
  id:          z.string().optional(),
  text:        z.string().max(20000),
  kind:        z.enum(OBSERVATION_ITEM_KINDS).optional().default("rating"),
  ratingScale: z.array(z.string().min(1)).min(2).optional().default(DEFAULT_RATING_SCALE),
  sectionId:   z.string().optional().nullable().default(null),
  competencyIndicatorIds: z.array(z.string()).optional().default([]),
  points:      z.number().min(0).optional().default(1),
  indicatorMarks: z.array(indicatorMarkSchema).optional().default([]),
  // Grading rubric for this observation indicator — see scoringCriterionSchema above.
  scoringCriteria: z.array(scoringCriterionSchema).optional().default([]),
}).refine((d) => hasRichContent(d.text), { message: "Indicator text is required", path: ["text"] });

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
  // How many marks this checkpoint is worth — milestones had no scoring dimension at all before
  // (pure checklist), so grading one meant nothing beyond a description. Defaults to 0 so
  // existing authored milestones don't suddenly carry marks nobody intended.
  points:      z.number().min(0).optional().default(0),
});

const createAssessmentSchema = z.object({
  name:          z.string().min(1, "Assessment name is required").max(150, "Max 150 characters"),
  type:          z.enum(ASSESSMENT_TYPES, { errorMap: () => ({ message: "Select a valid assessment type" }) }),
  description:   z.string().max(20000).optional().default(""),
  instructions:  z.string().max(20000).optional().default(""),
  structureType: z.enum(STRUCTURE_MODES).optional().default("mixed"),
  overview:      z.string().max(20000).optional().default(""),
  sections:      z.array(sectionSchema).optional().default([]),
  items:         z.array(itemSchema).optional().default([]),
  rubric:        z.array(rubricCriterionSchema).optional().default([]),
  indicators:    z.array(indicatorSchema).optional().default([]),
  deliverables:  z.array(deliverableSchema).optional().default([]),
  milestones:    z.array(milestoneSchema).optional().default([]),
});

const updateAssessmentSchema = createAssessmentSchema.partial();

const linkCompetencySchema = z.object({
  competencyId: z.string().min(1, "competencyId is required"),
});

const linkPathwaySchema = z.object({
  pathwayId: z.string().min(1, "pathwayId is required"),
});

const linkInventoryItemSchema = z.object({
  inventoryItemId: z.string().min(1, "inventoryItemId is required"),
  quantity:        z.number().min(1, "Quantity must be at least 1").optional().default(1),
});

module.exports = {
  createAssessmentSchema,
  updateAssessmentSchema,
  linkCompetencySchema,
  linkPathwaySchema,
  linkInventoryItemSchema,
  ASSESSMENT_TYPES,
  DEFAULT_RATING_SCALE,
  DEFAULT_SURVEY_SCALE,
};
