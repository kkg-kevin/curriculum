const { z } = require("zod");

const createSystemLevelSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
});

const updateSystemLevelSchema = createSystemLevelSchema.partial();

const reorderSystemLevelsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

module.exports = {
  createSystemLevelSchema,
  updateSystemLevelSchema,
  reorderSystemLevelsSchema,
};
