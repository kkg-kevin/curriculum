const crypto = require("crypto");

function generateId() {
  return crypto.randomUUID();
}

// mysql2 auto-parses JSON columns back into JS objects/arrays on read, but does NOT
// auto-serialize a JS object/array passed as a bound param on write (it gets spread as
// positional values instead, breaking the insert) — every JSON column needs this on the way in.
function toJson(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

// Applies toJson() to the given field names of `data`, but only where the caller actually
// provided that field — leaves genuinely-absent (undefined) keys untouched so a partial
// update patch doesn't accidentally null out a JSON column the caller never meant to touch.
function stringifyJsonFields(data, fields) {
  const result = { ...data };
  for (const field of fields) {
    if (result[field] !== undefined) result[field] = toJson(result[field]);
  }
  return result;
}

function filterDefined(data) {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

async function firstOrNull(queryBuilder) {
  const row = await queryBuilder.first();
  return row === undefined ? null : row;
}

// Standard create(): stamps id + createdAt (+ updatedAt unless disabled), inserts, returns
// the inserted record — same contract every *.model.js's create() had against JSON files.
async function createRecord(db, table, data, { updatedAt = true } = {}) {
  const now = new Date();
  const record = { ...filterDefined(data), id: data.id || generateId(), createdAt: now };
  if (updatedAt) record.updatedAt = now;
  await db(table).insert(record);
  return record;
}

// Standard update(): filters undefined keys, stamps updatedAt, returns the updated record or
// null if no row matched `id` — same contract every *.model.js's update() had.
async function updateRecord(db, table, id, data, { updatedAt = true } = {}) {
  const patch = filterDefined(data);
  delete patch.id;
  if (updatedAt) patch.updatedAt = new Date();
  const count = await db(table).where({ id }).update(patch);
  if (count === 0) return null;
  return firstOrNull(db(table).where({ id }));
}

async function deleteRecord(db, table, id) {
  const count = await db(table).where({ id }).del();
  return count > 0;
}

module.exports = {
  generateId,
  toJson,
  stringifyJsonFields,
  filterDefined,
  firstOrNull,
  createRecord,
  updateRecord,
  deleteRecord,
};
