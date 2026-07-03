const { z } = require("zod");

const createCompetencySchema = z.object({
  name:             z.string().min(1, "Name is required").max(150),
  description:      z.string().max(500).optional().default(""),
  minimumThreshold: z.number().min(0).max(100).optional().default(60),
  weight:           z.number().min(0).max(100).optional().default(0),
});

const updateCompetencySchema = createCompetencySchema.partial();

const createIndicatorSchema = z.object({
  name:        z.string().min(1, "Name is required").max(150),
  description: z.string().max(300).optional().default(""),
  weight:      z.number().min(0).max(100).optional().default(0),
});

const updateIndicatorSchema = createIndicatorSchema.partial();

module.exports = {
  createCompetencySchema,
  updateCompetencySchema,
  createIndicatorSchema,
  updateIndicatorSchema,
};
