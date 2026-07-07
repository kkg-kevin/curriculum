const { z } = require("zod");

const INVENTORY_CATEGORIES = ["Robots", "Electronics", "Components", "Consumables", "Tools", "Other"];

const createInventoryItemSchema = z.object({
  name:        z.string().min(1, "Name is required").max(150),
  category:    z.enum(INVENTORY_CATEGORIES, { errorMap: () => ({ message: "Select a valid category" }) }).optional().default("Other"),
  unit:        z.string().min(1).max(30).optional().default("pcs"),
  description: z.string().max(500).optional().default(""),
});

const updateInventoryItemSchema = createInventoryItemSchema.partial();

module.exports = {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  INVENTORY_CATEGORIES,
};
