// Parses a partial-update body and keeps only the fields the caller actually sent.
//
// An update schema is usually the create schema made `.partial()`. Under Zod 4 a field declared
// with `.default(...)` still gets its default when it is missing, even inside a partial schema —
// so a patch of `{ saleStatus: "for_sale" }` comes back from `.parse()` carrying `description: ""`,
// `highlights: []` and every other default, and saving that would blank those fields on the
// record. The full parse still runs (so cross-field checks see a complete object); only what was
// sent is passed on.
function parsePatch(schema, body) {
  const parsed = schema.parse(body);
  const sent = body && typeof body === "object" ? Object.keys(body) : [];
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => sent.includes(key)));
}

module.exports = { parsePatch };
