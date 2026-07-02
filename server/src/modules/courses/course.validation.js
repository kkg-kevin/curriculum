const { z } = require("zod");

const createCourseSchema = z.object({
  name:        z.string().min(1, "Course name is required").max(150, "Max 150 characters"),
  description: z.string().max(1000, "Max 1000 characters").optional().default(""),
  status:      z.enum(["active", "inactive"]).default("active"),
});

const updateCourseSchema = createCourseSchema.partial();

module.exports = { createCourseSchema, updateCourseSchema };
