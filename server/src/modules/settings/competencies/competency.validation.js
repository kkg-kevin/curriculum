const { z } = require("zod");

// Base indicators authored on the global competency — how ANY curriculum can
// recognize this competency being demonstrated. Distinct from the per-curriculum
// indicators in competency-framework (those add threshold/weight scoring on top,
// scoped to one curriculum's adoption of the competency).
const indicatorSchema = z.object({
  id:          z.string().optional(),
  name:        z.string().min(1, "Name is required").max(150),
  description: z.string().max(300).optional().default(""),
});

const createCompetencySchema = z.object({
  name:        z.string().min(1, "Name is required").max(150),
  description: z.string().max(500).optional().default(""),
  indicators:  z.array(indicatorSchema).optional().default([]),
});

const updateCompetencySchema = createCompetencySchema.partial();

module.exports = {
  indicatorSchema,
  createCompetencySchema,
  updateCompetencySchema,
};
