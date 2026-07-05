const { z } = require("zod");

const createCourseSchema = z.object({
  name:        z.string().min(1, "Course name is required"),
  description: z.string().optional().default(""),
  coverImage:  z.string().nullable().optional().default(null),
});

const updateCourseSchema = createCourseSchema.partial();

const RESOURCE_AUDIENCES = ["teacher", "student", "both"];

const resourceSchema = z.object({
  id:       z.string().min(1),
  filename: z.string().min(1),
  url:      z.string().min(1),
  mimeType: z.string().min(1),
  size:     z.number(),
  audience: z.enum(RESOURCE_AUDIENCES).optional().default("both"),
});

const repeatableItemSchema = z.object({
  id:      z.string().min(1),
  title:   z.string().optional().default(""),
  content: z.string().optional().default(""),
});

// An Activity is one unit with two fixed sub-parts (Class Activity + Wrap Activity), not a
// single content blob — sessions can have multiple Activity units, each holding both parts.
const activityItemSchema = z.object({
  id:            z.string().min(1),
  title:         z.string().optional().default(""),
  classActivity: z.string().optional().default(""),
  wrapActivity:  z.string().optional().default(""),
});

const createSessionSchema = z.object({
  title:        z.string().optional().default(""),
  order:        z.number().int().min(1).optional(),
  outcomes:     z.array(z.string().min(1)).optional().default([]),
  introduction: z.string().optional().default(""),
  iceBreaker:   z.string().optional().default(""),
  mainConcepts: z.array(repeatableItemSchema).optional().default([]),
  activities:   z.array(activityItemSchema).optional().default([]),
  notes:        z.array(repeatableItemSchema).optional().default([]),
  resources:    z.array(resourceSchema).optional().default([]),
});

const updateSessionSchema = createSessionSchema.partial();

const bulkCreateSessionsSchema = z.object({
  count: z.number().int().min(1, "At least 1 session").max(30, "Max 30 sessions at once"),
});

const linkCompetencySchema = z.object({
  competencyId: z.string().min(1, "competencyId is required"),
});

const linkLearningAreaSchema = z.object({
  learningAreaId: z.string().min(1, "learningAreaId is required"),
});

module.exports = {
  createCourseSchema,
  updateCourseSchema,
  createSessionSchema,
  updateSessionSchema,
  bulkCreateSessionsSchema,
  linkCompetencySchema,
  linkLearningAreaSchema,
};
