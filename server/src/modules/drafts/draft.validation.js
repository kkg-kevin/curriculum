const { z } = require("zod");

// A draft is unfinished by definition — a question with no text yet, a course with no name — so
// the form is kept as it is and only checked properly when the record itself is saved.
const content = z.record(z.string(), z.unknown());

const createDraftSchema = z.object({
  // Which form (see draft.kinds.js); defaults to the first kind the route serves.
  kind: z.string().max(30).optional(),
  // The record being edited; left out for one not saved yet.
  recordId: z.string().min(1).max(36).optional().nullable(),
  // A new assessment's type.
  type: z.string().max(20).optional().nullable(),
  content,
});

const updateDraftSchema = z.object({
  // The revision this write builds on — see the drafts migration.
  revision: z.number().int().min(1),
  content,
});

module.exports = { createDraftSchema, updateDraftSchema };
