const { z } = require("zod");

// Field schemas WITHOUT .default() — see the note on updatePathwaySchema below.
const nameField = z.string().min(1, "Name is required").max(100);
const descriptionField = z.string().max(500);
const colorField = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color");
// Course ids, not free-typed names — the service layer checks each id resolves to a real course.
const coursesField = z.array(z.string().min(1));

const createPathwaySchema = z.object({
  name: nameField,
  description: descriptionField.optional().default(""),
  color: colorField.optional().default("#25476a"),
  courses: coursesField.optional().default([]),
});

// The update schema is deliberately NOT `createPathwaySchema.partial()`: `.partial()` makes
// each key optional but Zod's `.default()` STILL fires for an absent key, so a PUT that only
// sends `{ name }` would parse to `{ name, description: "", color: "#25476a", courses: [] }` and
// silently blank the other columns (the model's updateRecord only skips genuinely-`undefined`
// keys). Rebuild from the no-default field schemas so an omitted field stays omitted.
const updatePathwaySchema = z.object({
  name: nameField.optional(),
  description: descriptionField.optional(),
  color: colorField.optional(),
  courses: coursesField.optional(),
});

module.exports = {
  createPathwaySchema,
  updatePathwaySchema,
};
