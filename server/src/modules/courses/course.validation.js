const { z } = require("zod");

const createCourseSchema = z.object({
  name:        z.string().min(1, "Course name is required"),
  // Auto-generated client-side from the name (or server-side when duplicating) — never typed
  // in directly. See generateCourseCode.
  code:        z.string().max(20).regex(/^[A-Z0-9-]*$/i, "Only letters, numbers, and hyphens").default(""),
  // New courses start as "draft" — an admin promotes to "active" when it's ready to be used
  // (linked to curricula, assigned to learners), or "archived" to retire it without deleting it.
  status:      z.enum(["draft", "active", "archived"]).default("draft"),
  description: z.string().optional().default(""),
  coverImage:  z.string().nullable().optional().default(null),
  ageMin:      z.number().int().min(0).max(120).nullable().optional().default(null),
  ageMax:      z.number().int().min(0).max(120).nullable().optional().default(null),
});

const updateCourseSchema = createCourseSchema.partial();

const RESOURCE_AUDIENCES = ["teacher", "student", "both"];
const RESOURCE_TYPES = ["file", "link"];

// A resource is either an uploaded file (mimeType/size populated by the upload endpoint) or an
// external link (just a URL + label, no upload) — `type` defaults to "file" so resources saved
// before links existed keep validating unchanged.
const resourceSchema = z.object({
  id:       z.string().min(1),
  filename: z.string().min(1),
  url:      z.string().min(1),
  type:     z.enum(RESOURCE_TYPES).optional().default("file"),
  mimeType: z.string().optional().default(""),
  size:     z.number().optional().default(0),
  audience: z.enum(RESOURCE_AUDIENCES).optional().default("both"),
});

const repeatableItemSchema = z.object({
  id:      z.string().min(1),
  title:   z.string().optional().default(""),
  content: z.string().optional().default(""),
});

const activityItemSchema = repeatableItemSchema.extend({
  mode: z.enum(["individual", "group"]).optional().default("individual"),
});

const assessmentAttachmentSchema = z.object({
  assessmentId: z.string().min(1),
  mode: z.enum(["individual", "group"]).optional().default("individual"),
});

const createSessionSchema = z.object({
  title:        z.string().optional().default(""),
  order:        z.number().int().min(1).optional(),
  moduleId:     z.string().nullable().optional().default(null),
  outcomes:     z.array(z.string().min(1)).optional().default([]),
  introduction: z.string().optional().default(""),
  mainConcepts: z.array(repeatableItemSchema).optional().default([]),
  activities:   z.array(activityItemSchema).optional().default([]),
  assessmentIds: z.array(z.string().min(1)).optional().default([]),
  assessmentAttachments: z.array(assessmentAttachmentSchema).optional().default([]),
  notes:        z.array(repeatableItemSchema).optional().default([]),
  resources:    z.array(resourceSchema).optional().default([]),
});

const updateSessionSchema = createSessionSchema.partial();

const bulkCreateSessionsSchema = z.object({
  count:    z.number().int().min(1, "At least 1 session").max(30, "Max 30 sessions at once"),
  moduleId: z.string().nullable().optional().default(null),
});

// A Module groups a course's Sessions under a named bucket (e.g. "Module 1" covering
// Sessions 1-10 of 30) — sessions keep their own global order/numbering regardless of
// which module they're in, or none at all (moduleId nullable — ungrouped is valid).
const createModuleSchema = z.object({
  name:  z.string().min(1, "Module name is required").max(150),
  order: z.number().int().min(1).optional(),
});

const updateModuleSchema = createModuleSchema.partial();

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
  createModuleSchema,
  updateModuleSchema,
  linkCompetencySchema,
  linkLearningAreaSchema,
};
