const { z } = require("zod");

// Admin authoring form for a Bootcamp — digifunzi-landing's src/mocks/fixtures/bootcamps.js
// shows the exact field set the public site's cards/detail page read.
const bootcampSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  description: z.string().trim().min(1, "Description is required"),
  coverImage: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["upcoming", "active", "completed"]).optional().default("upcoming"),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
  educationLevel: z.string().trim().max(50).optional().nullable(),
  gradeFrom: z.string().trim().max(30).optional().nullable(),
  gradeTo: z.string().trim().max(30).optional().nullable(),
  classes: z.array(z.string()).optional().default([]),
  courses: z.array(z.object({ name: z.string(), slug: z.string() })).optional().default([]),
  isPublished: z.boolean().optional().default(true),
});

const updateBootcampSchema = bootcampSchema.partial();

// Admin authoring form for a Project/Course — src/mocks/fixtures/projects.js's field set.
const projectSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  description: z.string().trim().min(1, "Description is required"),
  coverImage: z.string().trim().max(500).optional().nullable(),
  ageMin: z.coerce.number().int().min(0).max(25).optional().nullable(),
  ageMax: z.coerce.number().int().min(0).max(25).optional().nullable(),
  sessionCount: z.coerce.number().int().min(0).optional().nullable(),
  requirements: z.array(z.string()).optional().default([]),
  modules: z.array(z.string()).optional().default([]),
  isPublished: z.boolean().optional().default(true),
});

const updateProjectSchema = projectSchema.partial();

module.exports = { bootcampSchema, updateBootcampSchema, projectSchema, updateProjectSchema };
