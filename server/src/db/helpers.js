// Every table keys off the app's existing crypto.randomUUID() strings (see model.js's
// generateId()), not DB-generated ids — so ids/FKs are plain fixed-length strings, not
// knex's native uuid() type (which some dialects map to a binary column).
function id(table, columnName = "id") {
  table.string(columnName, 36).primary();
}

function fk(table, columnName) {
  return table.string(columnName, 36);
}

// No DB-level FOREIGN KEY constraints anywhere in this migration (see migration plan) —
// the source data has known soft/legacy references ("" sentinels, non-uuid placeholders,
// "system"/"system-backfill" sentinel strings) that would fail strict FK constraints. We
// index every FK-shaped column for query performance and enforce referential integrity at
// the application layer, same as the JSON-file era.
function timestamps(table, { updatedAt = true } = {}) {
  table.datetime("createdAt").notNullable();
  if (updatedAt) table.datetime("updatedAt").nullable();
}

module.exports = { id, fk, timestamps };
