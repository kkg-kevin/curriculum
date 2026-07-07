const { z } = require("zod");

const createLearningAreaSchema = z.object({
  name:        z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().default(""),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional().default("#25476a"),
  courses:     z.array(z.string().min(1).max(150)).optional().default([]),
});

const updateLearningAreaSchema = createLearningAreaSchema.partial();

module.exports = {
  createLearningAreaSchema,
  updateLearningAreaSchema,
};
