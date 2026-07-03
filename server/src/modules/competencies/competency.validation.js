const { z } = require("zod");

const createCompetencySchema = z.object({
  name:        z.string().min(1, "Name is required").max(150),
  description: z.string().max(500).optional().default(""),
});

const updateCompetencySchema = createCompetencySchema.partial();

module.exports = {
  createCompetencySchema,
  updateCompetencySchema,
};
