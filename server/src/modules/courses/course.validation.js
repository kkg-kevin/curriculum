const { z } = require("zod");

const createCourseSchema = z.object({
  name:        z.string().min(1, "Course name is required"),
  description: z.string().optional().default(""),
  coverImage:  z.string().nullable().optional().default(null),
});

const updateCourseSchema = createCourseSchema.partial();

const resourceSchema = z.object({
  id:       z.string().min(1),
  filename: z.string().min(1),
  url:      z.string().min(1),
  mimeType: z.string().min(1),
  size:     z.number(),
});

const createSessionSchema = z.object({
  title:                 z.string().min(1, "Session title is required"),
  order:                 z.number().int().min(1).optional(),
  outcomes:              z.array(z.string().min(1)).optional().default([]),
  introduction:          z.string().optional().default(""),
  iceBreaker:            z.string().optional().default(""),
  mainConceptsIntro:     z.string().optional().default(""),
  mainConceptsBodyTitle: z.string().optional().default("Body"),
  mainConceptsBody:      z.string().optional().default(""),
  classActivity:         z.string().optional().default(""),
  wrapActivity:          z.string().optional().default(""),
  notes:                 z.string().optional().default(""),
  resources:             z.array(resourceSchema).optional().default([]),
});

const updateSessionSchema = createSessionSchema.partial();

const bulkCreateSessionsSchema = z.object({
  count: z.number().int().min(1, "At least 1 session").max(30, "Max 30 sessions at once"),
});

module.exports = {
  createCourseSchema,
  updateCourseSchema,
  createSessionSchema,
  updateSessionSchema,
  bulkCreateSessionsSchema,
};
